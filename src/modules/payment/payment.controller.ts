import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { PaymentService } from './payment.service.js';
import { AppError } from '../../errors/AppError.js';

// 1. Tutor: Submit Payment
const submitPayment = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  if (!customReq.user?.userId) throw new AppError(401, 'Unauthorized');

  const {
    tuitionJobId,
    applicationId,
    paymentType,
    amount,
    paymentMethod,
    senderNumber,
    transactionId,
    notes,
  } = req.body;

  if (!amount || !paymentMethod || !senderNumber || !transactionId) {
    throw new AppError(400, 'Amount, payment method, sender number, and TrxID are required!');
  }

  const result = await PaymentService.submitPayment(
    customReq.user.userId,
    {
      tuitionJobId,
      applicationId,
      paymentType,
      amount: Number(amount),
      paymentMethod: paymentMethod.toLowerCase(),
      senderNumber,
      transactionId,
      notes,
    },
    req.file ? req.file.buffer : undefined
  );

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Payment request submitted successfully! Pending verification.',
    data: result,
  });
};

// 2. Tutor: Get Active Tuitions for Payment
const getTutorActiveTuitions = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  if (!customReq.user?.userId) throw new AppError(401, 'Unauthorized');

  const result = await PaymentService.getTutorActiveTuitions(customReq.user.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Active tuitions for payment fetched.',
    data: result,
  });
};

// 3. Tutor: Get My Payment History
const getMyPayments = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  if (!customReq.user?.userId) throw new AppError(401, 'Unauthorized');

  const result = await PaymentService.getMyPayments(customReq.user.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment history fetched.',
    data: result,
  });
};

// 4. Admin: Get All Payments
const getAllPaymentsAdmin = async (req: Request, res: Response) => {
  const { status, method, search, page, limit } = req.query as Record<string, string>;
  const queryObj: Record<string, any> = {};
  if (status) queryObj.status = status;
  if (method) queryObj.method = method;
  if (search) queryObj.search = search;
  if (page) queryObj.page = Number(page);
  if (limit) queryObj.limit = Number(limit);

  const result = await PaymentService.getAllPaymentsAdmin(queryObj);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All payment requests fetched for admin.',
    data: result,
  });
};

// 5. Admin: Approve Payment
const approvePayment = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  if (!customReq.user?.userId) throw new AppError(401, 'Unauthorized');

  const result = await PaymentService.approvePayment(
    String(req.params['id']),
    customReq.user.userId
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment approved successfully.',
    data: result,
  });
};

// 6. Admin: Reject Payment
const rejectPayment = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  if (!customReq.user?.userId) throw new AppError(401, 'Unauthorized');

  const { reason } = req.body;
  const result = await PaymentService.rejectPayment(
    String(req.params['id']),
    customReq.user.userId,
    reason
  );

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Payment rejected successfully.',
    data: result,
  });
};

// 7. Get Invoice / Receipt
const getInvoice = async (req: Request, res: Response) => {
  const result = await PaymentService.getInvoice(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Invoice fetched successfully.',
    data: result,
  });
};

export const PaymentController = {
  submitPayment,
  getTutorActiveTuitions,
  getMyPayments,
  getAllPaymentsAdmin,
  approvePayment,
  rejectPayment,
  getInvoice,
};
