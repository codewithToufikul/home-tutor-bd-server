import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { HireService } from './hire.service.js';

const createHireRequest = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const guardianId = customReq.user?.userId || null;
  const result = await HireService.createHireRequest(guardianId, req.body);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'হায়ার রিকোয়েস্ট সফলভাবে জমা হয়েছে। আমাদের প্রতিনিধি শীঘ্রই যোগাযোগ করবেন।',
    data: result,
  });
};

const getHireRequests = async (req: CustomRequest, res: Response) => {
  const result = await HireService.getHireRequests(req.user?.userId, req.user?.role);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Hire requests retrieved successfully.',
    data: result,
  });
};

const getHireRequestById = async (req: CustomRequest, res: Response) => {
  const result = await HireService.getHireRequestById(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Hire request retrieved successfully.',
    data: result,
  });
};

const updateHireRequestStatus = async (req: CustomRequest, res: Response) => {
  const result = await HireService.updateHireRequestStatus(
    String(req.params['id']),
    req.body,
    req.user!.role,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Hire request status updated successfully.',
    data: result,
  });
};

const confirmAndAssignTuition = async (req: CustomRequest, res: Response) => {
  const result = await HireService.confirmAndAssignTuition(
    String(req.params['id']),
    req.body,
    req.user!.userId,
    req.user!.role,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'টিউশন সফলভাবে কনফার্ম করা হয়েছে এবং টিউটরের ড্যাশবোর্ডে এসাইন করা হয়েছে।',
    data: result,
  });
};

export const HireController = {
  createHireRequest,
  getHireRequests,
  getHireRequestById,
  updateHireRequestStatus,
  confirmAndAssignTuition,
};

