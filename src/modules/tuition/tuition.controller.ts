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
  const result = await TuitionService.createJob(req.user?.userId, req.body);
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
  const clientIp = (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    req.ip ||
    '127.0.0.1'
  );
  const userAgent = (req.headers['user-agent'] as string) || 'Web Browser';

  const result = await TuitionService.applyToJob(
    String(req.params['id']),
    req.user!.userId,
    {
      ...req.body,
      ipAddress: clientIp,
      userAgent,
    },
  );
  sendResponse(res, { statusCode: 201, success: true, message: 'Application submitted.', data: result });
};

const getShortlistedTutors = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.getShortlistedTutors(
    String(req.params['id']),
    req.user!.userId,
    req.user!.role,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Shortlisted tutors retrieved.', data: result });
};

const rematchJob = async (req: CustomRequest, res: Response) => {
  const result = await TuitionService.rematchJob(
    String(req.params['id']),
    req.user!.userId,
    req.user!.role,
  );
  sendResponse(res, { statusCode: 200, success: true, message: result.message, data: null });
};

export const TuitionController = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  applyToJob,
  getShortlistedTutors,
  rematchJob,
};
