import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { TutorService } from './tutor.service.js';

const getAllTutors = async (req: Request, res: Response) => {
  const result = await TutorService.searchTutors(req.query as Record<string, string>);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Tutors retrieved successfully.',
    data: result.data,
    meta: result.meta,
  });
};

const getTutorById = async (req: Request, res: Response) => {
  const result = await TutorService.getTutorById(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Tutor retrieved successfully.', data: result });
};

const createMyProfile = async (req: CustomRequest, res: Response) => {
  const result = await TutorService.createMyProfile(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 201, success: true, message: 'Tutor profile created successfully.', data: result });
};

const updateMyProfile = async (req: CustomRequest, res: Response) => {
  const result = await TutorService.updateMyProfile(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 200, success: true, message: 'Tutor profile updated successfully.', data: result });
};

const getMyProfile = async (req: CustomRequest, res: Response) => {
  const result = await TutorService.getMyProfile(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'My tutor profile retrieved.', data: result });
};

const getMyApplications = async (req: CustomRequest, res: Response) => {
  const result = await TutorService.getMyApplications(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'My applications retrieved.', data: result });
};

const getMyHireRequests = async (req: CustomRequest, res: Response) => {
  const result = await TutorService.getMyHireRequests(req.user!.userId);
  sendResponse(res, { statusCode: 200, success: true, message: 'My hire requests retrieved.', data: result });
};

const addReview = async (req: Request, res: Response) => {
  const result = await TutorService.addReview(String(req.params['id']), Number(req.body.rating));
  sendResponse(res, { statusCode: 200, success: true, message: 'Review submitted successfully.', data: result });
};

export const TutorController = {
  getAllTutors,
  getTutorById,
  createMyProfile,
  updateMyProfile,
  getMyProfile,
  getMyApplications,
  getMyHireRequests,
  addReview,
};
