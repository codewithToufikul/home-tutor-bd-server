import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { ApplicationService } from './application.service.js';

const getMyApplications = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.getMyApplications(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'My applications retrieved successfully.', data: result });
};

const getApplicationById = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.getApplicationById(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Application retrieved successfully.', data: result });
};

const acceptApplication = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.acceptApplication(String(req.params['id']), req.user!.userId, req.user!.role);
  sendResponse(res, { statusCode: 200, success: true, message: 'Application accepted successfully.', data: result });
};

const rejectApplication = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.rejectApplication(String(req.params['id']), req.user!.userId, req.user!.role);
  sendResponse(res, { statusCode: 200, success: true, message: 'Application rejected successfully.', data: result });
};

const withdrawApplication = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.withdrawApplication(String(req.params['id']), req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'Application withdrawn successfully.', data: result });
};

const getJobApplications = async (req: CustomRequest, res: Response) => {
  const result = await ApplicationService.getJobApplications(
    String(req.params['jobId']),
    req.user!.userId,
    req.user!.role,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Job applications retrieved successfully.', data: result });
};

export const ApplicationController = {
  getMyApplications,
  getApplicationById,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
  getJobApplications,
};
