/**
 * Dual Pagination Strategy
 * ─────────────────────────────────────────────────────────────────
 * Strategy 1 — Offset Pagination (page + limit)
 *   GET /tutors?page=2&limit=20
 *   Uses $skip + $limit  ← simple, supports random access
 *   Downside: slow on huge datasets (skip N rows every time)
 *
 * Strategy 2 — Cursor Pagination (_id based)
 *   GET /tutors?cursor=65f8a3b2c1d4e5f6a7b8c9d0&limit=20
 *   Uses _id > cursor + $limit  ← O(log N), no skip
 *   Downside: forward-only, no random page jumps
 * ─────────────────────────────────────────────────────────────────
 */

import { Types } from 'mongoose';

export interface OffsetMeta {
  type: 'offset';
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface CursorMeta {
  type: 'cursor';
  limit: number;
  nextCursor: string | null;   // pass to next request as ?cursor=
  hasPrevCursor: boolean;
  hasMore: boolean;
}

export type PaginationMeta = OffsetMeta | CursorMeta;

// ─── Encode / Decode cursor ────────────────────────────────────────────────
// Cursor = base64( JSON({ _id, [sortField]: value }) )
// This lets us encode composite sort position cleanly.

export interface CursorPayload {
  _id: string;
  [key: string]: unknown;
}

export const encodeCursor = (payload: CursorPayload): string => {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
};

export const decodeCursor = (cursor: string): CursorPayload | null => {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
  } catch {
    return null;
  }
};

// ─── Detect which strategy is being used ──────────────────────────────────
export const isPaginationCursor = (query: Record<string, unknown>): boolean => {
  return typeof query['cursor'] === 'string' && query['cursor'] !== '';
};

// ─── Build $match condition for cursor pagination ──────────────────────────
// For sort: { isPremium: -1, rating: -1, _id: 1 }
// Next page condition (keyset pagination):
//   (isPremium < cur.isPremium)
//   OR (isPremium = cur.isPremium AND rating < cur.rating)
//   OR (isPremium = cur.isPremium AND rating = cur.rating AND _id > cur._id)
//
// We support two simple modes:
//   - Default (isPremium + rating sort): composite cursor
//   - createdAt sort: { _id: { $gt: cursor._id } } since ObjectId embeds timestamp

export type SortMode = 'default' | 'salary_asc' | 'salary_desc' | 'createdAt_desc' | 'rating_desc';

export const buildCursorMatchStage = (
  decoded: CursorPayload,
  sortMode: SortMode,
): Record<string, unknown> => {
  const cursorId = new Types.ObjectId(decoded._id);

  switch (sortMode) {
    case 'default':
    case 'rating_desc': {
      // Sort: isPremium DESC, rating DESC, _id DESC (tiebreaker, descending)
      const cursorIsPremium = decoded['isPremium'] as boolean ?? false;
      const cursorRating = decoded['rating'] as number ?? 0;
      return {
        $or: [
          // Lower premium tier than cursor
          { isPremium: { $lt: cursorIsPremium } },
          // Same premium tier, lower rating
          { isPremium: cursorIsPremium, rating: { $lt: cursorRating } },
          // Same premium + rating, next _id (tiebreaker, descending)
          { isPremium: cursorIsPremium, rating: cursorRating, _id: { $lt: cursorId } },
        ],
      };
    }

    case 'salary_asc': {
      // Sort: salary ASC, _id ASC (tiebreaker)
      const cursorSalary = decoded['salary'] as number ?? 0;
      return {
        $or: [
          { salary: { $gt: cursorSalary } },
          { salary: cursorSalary, _id: { $gt: cursorId } },
        ],
      };
    }

    case 'salary_desc': {
      // Sort: salary DESC, _id ASC (tiebreaker)
      const cursorSalary = decoded['salary'] as number ?? 0;
      return {
        $or: [
          { salary: { $lt: cursorSalary } },
          { salary: cursorSalary, _id: { $gt: cursorId } },
        ],
      };
    }

    case 'createdAt_desc':
    default: {
      // ObjectId already encodes creation time — just use _id DESC
      return { _id: { $lt: cursorId } };
    }
  }
};

// ─── Build nextCursor from the last document ───────────────────────────────
export const buildNextCursor = (
  lastDoc: Record<string, unknown>,
  sortMode: SortMode,
): string => {
  const base: CursorPayload = { _id: String(lastDoc['_id']) };

  if (sortMode === 'default' || sortMode === 'rating_desc') {
    base['isPremium'] = lastDoc['isPremium'];
    base['rating'] = lastDoc['rating'];
  } else if (sortMode === 'salary_asc' || sortMode === 'salary_desc') {
    base['salary'] = lastDoc['salary'];
  }
  // createdAt_desc: only _id needed

  return encodeCursor(base);
};

// ─── Resolve sort mode from query ─────────────────────────────────────────
export const resolveSortMode = (sortBy?: string, sortOrder?: string): SortMode => {
  if (sortBy === 'salary' && sortOrder === 'asc') return 'salary_asc';
  if (sortBy === 'salary') return 'salary_desc';
  if (sortBy === 'rating') return 'rating_desc';
  if (sortBy === 'createdAt') return 'createdAt_desc';
  return 'default'; // isPremium first, then rating
};

// ─── Build $sort stage from mode ──────────────────────────────────────────
export const buildSortStage = (mode: SortMode): Record<string, 1 | -1> => {
  switch (mode) {
    case 'default':
      // Premium first, then newest/latest first
      return { isPremium: -1, createdAt: -1, _id: -1 };
    case 'rating_desc':
      return { isPremium: -1, rating: -1, createdAt: -1, _id: -1 };
    case 'salary_asc':
      return { salary: 1, createdAt: -1, _id: -1 };
    case 'salary_desc':
      return { salary: -1, createdAt: -1, _id: -1 };
    case 'createdAt_desc':
      return { createdAt: -1, _id: -1 };
  }
};
