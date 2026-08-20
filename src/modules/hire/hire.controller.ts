import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { HireService } from './hire.service.js';

const createHireRequest = async (req: CustomRequest, res: Response) => {
  const result = await HireService.createHireRequest(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 201, success: true, message: 'Hire request sent successfully.', data: result });
};

const getHireRequests = async (req: CustomRequest, res: Response) => {
  const result = await HireService.getHireRequests(req.user!.userId, req.user!.role);
  sendResponse(res, { statusCode: 200, success: true, message: 'Hire requests retrieved successfully.', data: result });
};

const getHireRequestById = async (req: CustomRequest, res: Response) => {
  const result = await HireService.getHireRequestById(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Hire request retrieved successfully.', data: result });
};

const approveHireRequest = async (req: CustomRequest, res: Response) => {
  const result = await HireService.approveHireRequest(String(req.params['id']), req.user!.userId, req.user!.role);
  sendResponse(res, { statusCode: 200, success: true, message: 'Hire request approved successfully.', data: result });
};

const rejectHireRequest = async (req: CustomRequest, res: Response) => {
  const result = await HireService.rejectHireRequest(String(req.params['id']), req.user!.userId, req.user!.role);
  sendResponse(res, { statusCode: 200, success: true, message: 'Hire request rejected successfully.', data: result });
};

export const HireController = {
  createHireRequest,
  getHireRequests,
  getHireRequestById,
  approveHireRequest,
  rejectHireRequest,
};
