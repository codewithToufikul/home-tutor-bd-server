import type { Response } from 'express';
import type { CursorMeta, OffsetMeta } from './pagination.js';

export type PaginationMeta = OffsetMeta | CursorMeta;

interface IResponse<T> {
  statusCode: number;
  success: boolean;
  message?: string;
  data?: T;
  meta?: PaginationMeta;
}

export const sendResponse = <T>(res: Response, payload: IResponse<T>) => {
  const body: Record<string, unknown> = {
    success: payload.success,
    message: payload.message,
    data: payload.data,
  };

  if (payload.meta) {
    body['meta'] = payload.meta;
  }

  res.status(payload.statusCode).json(body);
};
