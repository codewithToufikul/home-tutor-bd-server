import { AppError } from '../../errors/AppError.js';
import type { IHireRequest } from './hire.interface.js';
import { HireRequest } from './hire.model.js';

const createHireRequest = async (guardianId: string, payload: Partial<IHireRequest>) => {
  if (!payload.tutorId) {
    throw new AppError(400, 'Tutor ID is required');
  }

  const data: Record<string, unknown> = {
    guardianId,
    tutorId: payload.tutorId,
    message: payload.message || '',
    status: 'Pending',
  };

  if (payload.jobId) {
    data['jobId'] = payload.jobId;
  }

  const hireRequest = await HireRequest.create(data);
  return hireRequest;
};

const getHireRequests = async (userId: string, userRole: string) => {
  const filter: Record<string, unknown> = {};

  if (userRole === 'tutor') {
    filter['tutorId'] = userId;
  } else if (userRole === 'guardian' || userRole === 'student') {
    filter['guardianId'] = userId;
  }

  const requests = await HireRequest.find(filter)
    .populate('guardianId', 'name email phone avatar')
    .populate('tutorId', 'name email phone avatar')
    .populate('jobId')
    .sort({ createdAt: -1 });

  return requests;
};

const getHireRequestById = async (id: string) => {
  const request = await HireRequest.findById(id)
    .populate('guardianId', 'name email phone avatar')
    .populate('tutorId', 'name email phone avatar')
    .populate('jobId');

  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }
  return request;
};

const approveHireRequest = async (id: string, userId: string, userRole: string) => {
  const request = await HireRequest.findById(id);
  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }

  if (userRole !== 'admin' && String(request.tutorId) !== userId) {
    throw new AppError(403, 'You are not authorized to approve this hire request!');
  }

  request.status = 'Approved';
  await request.save();
  return request;
};

const rejectHireRequest = async (id: string, userId: string, userRole: string) => {
  const request = await HireRequest.findById(id);
  if (!request) {
    throw new AppError(404, 'Hire request not found!');
  }

  if (userRole !== 'admin' && String(request.tutorId) !== userId) {
    throw new AppError(403, 'You are not authorized to reject this hire request!');
  }

  request.status = 'Rejected';
  await request.save();
  return request;
};

export const HireService = {
  createHireRequest,
  getHireRequests,
  getHireRequestById,
  approveHireRequest,
  rejectHireRequest,
};
