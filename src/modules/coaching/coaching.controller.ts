import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { CoachingService } from './coaching.service.js';

const getProfile = async (req: CustomRequest, res: Response) => {
  const result = await CoachingService.getProfile(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'Coaching profile retrieved.', data: result });
};

const updateProfile = async (req: CustomRequest, res: Response) => {
  const result = await CoachingService.updateProfile(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: 'Coaching profile updated.', data: result });
};

const createBatch = async (req: CustomRequest, res: Response) => {
  const result = await CoachingService.createBatch(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 201, success: true, message: 'Batch created successfully.', data: result });
};

const deleteBatch = async (req: CustomRequest, res: Response) => {
  const result = await CoachingService.deleteBatch(req.user!.userId, String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Batch deleted successfully.', data: result });
};

const getStats = async (req: CustomRequest, res: Response) => {
  const result = await CoachingService.getStats(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'Coaching stats retrieved.', data: result });
};

const getAllCoachingCenters = async (_req: Request, res: Response) => {
  const result = await CoachingService.getAllCoachingCenters();
  sendResponse(res, { statusCode: 200, success: true, message: 'All coaching centers retrieved.', data: result });
};


const enrollInBatch = async (req: CustomRequest, res: Response) => {
  const { coachingId, batchId } = req.params;
  const result = await CoachingService.enrollInBatch(String(coachingId), String(batchId), req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'Successfully enrolled in coaching batch.', data: result });
};

export const CoachingController = {
  enrollInBatch,
  getProfile,
  updateProfile,
  createBatch,
  deleteBatch,
  getStats,
  getAllCoachingCenters,
};
