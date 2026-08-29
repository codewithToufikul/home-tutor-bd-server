import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { AdminService } from './admin.service.js';

const getDashboardStats = async (_req: Request, res: Response) => {
  const result = await AdminService.getDashboardStats();
  sendResponse(res, { statusCode: 200, success: true, message: 'Dashboard stats retrieved.', data: result });
};

const getAllUsers = async (req: Request, res: Response) => {
  const result = await AdminService.getAllUsers(req.query);
  sendResponse(res, { statusCode: 200, success: true, message: 'Users retrieved successfully.', data: result });
};

const updateUserStatus = async (req: Request, res: Response) => {
  const result = await AdminService.updateUserStatus(String(req.params['id']), req.body.status);
  sendResponse(res, { statusCode: 200, success: true, message: 'User status updated.', data: result });
};

const getPendingTutors = async (_req: Request, res: Response) => {
  const result = await AdminService.getPendingTutors();
  sendResponse(res, { statusCode: 200, success: true, message: 'Pending tutors retrieved.', data: result });
};

const approveTutor = async (req: Request, res: Response) => {
  const result = await AdminService.approveTutor(String(req.params['id']), req.body.isApproved ?? true);
  sendResponse(res, { statusCode: 200, success: true, message: 'Tutor approval updated.', data: result });
};

const getPendingJobs = async (_req: Request, res: Response) => {
  const result = await AdminService.getPendingJobs();
  sendResponse(res, { statusCode: 200, success: true, message: 'Pending jobs retrieved.', data: result });
};

const approveJob = async (req: Request, res: Response) => {
  const result = await AdminService.approveJob(String(req.params['id']), req.body.approvalStatus || 'Approved');
  sendResponse(res, { statusCode: 200, success: true, message: 'Job approval updated.', data: result });
};

const getVerifications = async (_req: Request, res: Response) => {
  const result = await AdminService.getVerifications();
  sendResponse(res, { statusCode: 200, success: true, message: 'Verification requests retrieved.', data: result });
};

const updateVerificationStatus = async (req: CustomRequest, res: Response) => {
  const result = await AdminService.updateVerificationStatus(
    String(req.params['id']),
    req.user!.userId,
    req.body.status,
    req.body.rejectionReason,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Verification status updated.', data: result });
};

const getPayments = async (_req: Request, res: Response) => {
  const result = await AdminService.getPayments();
  sendResponse(res, { statusCode: 200, success: true, message: 'Payments retrieved.', data: result });
};

const updatePaymentStatus = async (req: CustomRequest, res: Response) => {
  const result = await AdminService.updatePaymentStatus(
    String(req.params['id']),
    req.user!.userId,
    req.body.status,
  );
  sendResponse(res, { statusCode: 200, success: true, message: 'Payment status updated.', data: result });
};

const deleteUser = async (req: Request, res: Response) => {
  const result = await AdminService.deleteUser(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'User deleted successfully.', data: result });
};

const getAllApplications = async (_req: Request, res: Response) => {
  const result = await AdminService.getAllApplications();
  sendResponse(res, { statusCode: 200, success: true, message: 'Applications retrieved.', data: result });
};

const createStaff = async (req: CustomRequest, res: Response) => {
  const result = await AdminService.createStaff(req.user!.userId, req.body);
  sendResponse(res, { statusCode: 201, success: true, message: 'New staff created successfully.', data: result });
};

const getAllStaff = async (_req: Request, res: Response) => {
  const result = await AdminService.getAllStaff();
  sendResponse(res, { statusCode: 200, success: true, message: 'Staff list retrieved.', data: result });
};

const updateStaffStatus = async (req: Request, res: Response) => {
  const result = await AdminService.updateStaffStatus(String(req.params['id']), req.body.status);
  sendResponse(res, { statusCode: 200, success: true, message: 'Staff status updated.', data: result });
};

const updateStaffPermissions = async (req: Request, res: Response) => {
  const result = await AdminService.updateStaffPermissions(String(req.params['id']), req.body.permissions);
  sendResponse(res, { statusCode: 200, success: true, message: 'Staff permissions updated.', data: result });
};

const deleteStaff = async (req: Request, res: Response) => {
  const result = await AdminService.deleteStaff(String(req.params['id']));
  sendResponse(res, { statusCode: 200, success: true, message: 'Staff account deleted.', data: result });
};

export const AdminController = {
  deleteUser,
  getDashboardStats,
  getAllApplications,
  getAllUsers,
  updateUserStatus,
  getPendingTutors,
  approveTutor,
  getPendingJobs,
  approveJob,
  getVerifications,
  updateVerificationStatus,
  getPayments,
  updatePaymentStatus,
  createStaff,
  getAllStaff,
  updateStaffStatus,
  updateStaffPermissions,
  deleteStaff,
};
