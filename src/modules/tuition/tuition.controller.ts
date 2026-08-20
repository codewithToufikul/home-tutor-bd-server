import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { TuitionService } from './tuition.service.js';

const getAllJobs = async (req: Request, res: Response) => {
  const result = await TuitionService.getAllJobs(req.query as Record<string, string>);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Tuition jobs retrieved successfully.',
    data: result.data,
    meta: result.meta,
  });
};

const getJobById = async (req: Request, res: Response) => {
  const result = await TuitionService.getJobById(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Tuition job retrieved.', data: result });
};

const createJob = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.createJob(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 201, success: true, message: 'Tuition job posted.', data: result });
};

const updateJob = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.updateJob(
    String(req.params['id']),
    req.user!.userId,
    req.user!.role,
    req.body,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Tuition job updated.', data: result });
};

const deleteJob = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.deleteJob(
    String(req.params['id']),
    req.user!.userId,
    req.user!.role,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Tuition job deleted.', data: result });
};

const applyToJob = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.applyToJob(
    String(req.params['id']),
    req.user!.userId,
    req.body.expectedSalary,
  );
  sendResponse(res, { statusCode: 201, success: true, message: 'Application submitted.', data: result });
};

export const TuitionController = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
};
