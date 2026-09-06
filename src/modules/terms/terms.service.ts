import { Term, DEFAULT_TERMS } from './terms.model.js';
import type { ITerm, TermCategory } from './terms.interface.js';

// Get terms (seeds default if none exist in DB)
const getAllTerms = async (category?: string) => {
  const count = await Term.countDocuments();
  if (count === 0) {
    await Term.insertMany(DEFAULT_TERMS);
  }

  const query: Record<string, any> = {};
  if (category && category !== 'all') {
    query.category = category;
  }

  return Term.find(query).sort({ order: 1, createdAt: 1 }).lean();
};

const getPublicTerms = async (category?: string) => {
  const count = await Term.countDocuments();
  if (count === 0) {
    await Term.insertMany(DEFAULT_TERMS);
  }

  const query: Record<string, any> = { isActive: true };
  if (category && category !== 'all') {
    query.category = category;
  }

  return Term.find(query).sort({ order: 1, createdAt: 1 }).lean();
};

const createTerm = async (payload: Partial<ITerm>, userId?: string) => {
  const maxOrderTerm = await (Term.findOne({ category: payload.category } as any).sort({ order: -1 }).lean() as Promise<ITerm | null>);
  const nextOrder = (maxOrderTerm?.order ?? 0) + 1;

  const data: Record<string, any> = {
    ...payload,
    order: payload.order ?? nextOrder,
    isActive: payload.isActive ?? true,
  };
  if (userId) data.updatedBy = userId;

  return Term.create(data);
};

const updateTerm = async (id: string, payload: Partial<ITerm>, userId?: string) => {
  const updateData: Record<string, any> = { ...payload };
  if (userId) updateData.updatedBy = userId;

  return Term.findByIdAndUpdate(
    id,
    updateData,
    { new: true, runValidators: true }
  );
};

const deleteTerm = async (id: string) => {
  return Term.findByIdAndDelete(id);
};

const bulkUpdateTerms = async (
  terms: Array<{ _id: string; title?: string; content?: string; order?: number; isActive?: boolean; category?: TermCategory }>,
  userId?: string
) => {
  const ops: any[] = terms.map((t) => {
    const $set: Record<string, any> = {};
    if (t.title !== undefined) $set.title = t.title;
    if (t.content !== undefined) $set.content = t.content;
    if (t.order !== undefined) $set.order = t.order;
    if (t.isActive !== undefined) $set.isActive = t.isActive;
    if (t.category !== undefined) $set.category = t.category;
    if (userId) $set.updatedBy = userId;

    return {
      updateOne: {
        filter: { _id: t._id },
        update: { $set },
      },
    };
  });

  if (ops.length > 0) {
    await Term.bulkWrite(ops);
  }

  return Term.find().sort({ order: 1, createdAt: 1 }).lean();
};

const resetToDefaults = async (userId?: string) => {
  await Term.deleteMany({});
  const items = DEFAULT_TERMS.map((t) => {
    const item: Record<string, any> = { ...t };
    if (userId) item.updatedBy = userId;
    return item;
  });
  const seeded = await Term.insertMany(items);
  return seeded;
};

export const TermService = {
  getAllTerms,
  getPublicTerms,
  createTerm,
  updateTerm,
  deleteTerm,
  bulkUpdateTerms,
  resetToDefaults,
};
