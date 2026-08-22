import type { Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { EnrollmentService } from './enrollment.service.js';

/* Student submits enrollment */
const enroll = async (req: CustomRequest, res: Response) => {
  const { coachingId, batchId } = req.params;
  const result = await EnrollmentService.enroll(
    String(coachingId),
    String(batchId),
    req.user!.userId,
    req.body,
  );
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Enrollment request submitted successfully.',
    data: result,
  });
};

/* Coaching: get all enrollments for my center */
const getMyEnrollments = async (req: CustomRequest, res: Response) => {
  const result = await EnrollmentService.getMyEnrollments(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Enrollments retrieved.',
    data: result,
  });
};

/* Coaching: approve or reject an enrollment */
const updateStatus = async (req: CustomRequest, res: Response) => {
  const { enrollmentId } = req.params;
  const { status, note } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status. Must be approved or rejected.' });
    return;
  }
  const result = await EnrollmentService.updateEnrollmentStatus(
    req.user!.userId,
    String(enrollmentId),
    status,
    note,
  );
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: `Enrollment ${status} successfully.`,
    data: result,
  });
};

/* Student: get my own enrollments */
const getStudentEnrollments = async (req: CustomRequest, res: Response) => {
  const result = await EnrollmentService.getStudentEnrollments(req.user!.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Your enrollments retrieved.',
    data: result,
  });
};

export const EnrollmentController = {
  enroll,
  getMyEnrollments,
  updateStatus,
  getStudentEnrollments,
};
