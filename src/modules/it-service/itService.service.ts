import { AppError } from '../../errors/AppError.js';
import { ITService } from './itService.model.js';
import type { IITService } from './itService.interface.js';

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const createService = async (payload: Partial<IITService>, creatorId: string) => {
  let slug = payload.slug || generateSlug(payload.title || 'service');
  
  // Ensure unique slug
  let count = 1;
  let uniqueSlug = slug;
  while (await ITService.findOne({ slug: uniqueSlug })) {
    uniqueSlug = `${slug}-${count}`;
    count++;
  }

  const newService = await ITService.create({
    ...payload,
    slug: uniqueSlug,
    createdBy: creatorId,
  });

  return newService;
};

const getAllServices = async (query: Record<string, unknown>) => {
  const filter: Record<string, unknown> = {};

  if (query['category'] && query['category'] !== 'all') {
    filter['category'] = query['category'];
  }

  // If public query (or isActive explicitly specified)
  if (query['isActive'] !== undefined) {
    filter['isActive'] = query['isActive'] === 'true' || query['isActive'] === true;
  }

  if (query['search']) {
    const searchRegex = new RegExp(String(query['search']), 'i');
    filter['$or'] = [
      { title: searchRegex },
      { shortDescription: searchRegex },
      { fullDescription: searchRegex },
      { technologies: searchRegex },
    ];
  }

  const services = await ITService.find(filter)
    .populate('createdBy', 'name email avatar role')
    .sort({ order: 1, createdAt: -1 });

  return services;
};

const getServiceById = async (idOrSlug: string) => {
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(idOrSlug);
  const query = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

  const service = await ITService.findOne(query).populate(
    'createdBy',
    'name email avatar role',
  );

  if (!service) {
    throw new AppError(404, 'IT Service not found!');
  }

  return service;
};

const updateService = async (id: string, payload: Partial<IITService>) => {
  if (payload.title && !payload.slug) {
    payload.slug = generateSlug(payload.title);
  }

  const updatedService = await ITService.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('createdBy', 'name email avatar role');

  if (!updatedService) {
    throw new AppError(404, 'IT Service not found to update!');
  }

  return updatedService;
};

const deleteService = async (id: string) => {
  const deletedService = await ITService.findByIdAndDelete(id);
  if (!deletedService) {
    throw new AppError(404, 'IT Service not found to delete!');
  }
  return deletedService;
};

export const ITServiceLogic = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
};
