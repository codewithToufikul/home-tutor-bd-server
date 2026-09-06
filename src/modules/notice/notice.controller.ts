import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { NoticeService } from './notice.service.js';

const createNotice = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const result = await NoticeService.createNotice(req.body, customReq.user?.userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Notice created and broadcasted successfully.',
    data: result,
  });
};

const getNotices = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const userRole = (req.query['audience'] as string) || customReq.user?.role;
  const result = await NoticeService.getNoticesForUser(userRole);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notices retrieved successfully.',
    data: result,
  });
};

const getAdminNotices = async (_req: Request, res: Response) => {
  const result = await NoticeService.getAllNoticesAdmin();
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All notices retrieved for admin.',
    data: result,
  });
};

const getNoticeById = async (req: Request, res: Response) => {
  const result = await NoticeService.getNoticeById(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notice retrieved successfully.',
    data: result,
  });
};

const updateNotice = async (req: Request, res: Response) => {
  const result = await NoticeService.updateNotice(String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notice updated successfully.',
    data: result,
  });
};

const deleteNotice = async (req: Request, res: Response) => {
  const result = await NoticeService.deleteNotice(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Notice deleted successfully.',
    data: result,
  });
};

export const NoticeController = {
  createNotice,
  getNotices,
  getAdminNotices,
  getNoticeById,
  updateNotice,
  deleteNotice,
};
