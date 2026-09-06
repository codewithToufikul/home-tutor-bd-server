import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { TermService } from './terms.service.js';

const getPublicTerms = async (req: Request, res: Response) => {
  const category = req.query['category'] as string | undefined;
  const result = await TermService.getPublicTerms(category);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Terms retrieved successfully.',
    data: result,
  });
};

const getAllTermsAdmin = async (req: Request, res: Response) => {
  const category = req.query['category'] as string | undefined;
  const result = await TermService.getAllTerms(category);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'All terms retrieved for admin.',
    data: result,
  });
};

const createTerm = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const result = await TermService.createTerm(req.body, customReq.user?.userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Term created successfully.',
    data: result,
  });
};

const updateTerm = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const result = await TermService.updateTerm(String(req.params['id']), req.body, customReq.user?.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Term updated successfully.',
    data: result,
  });
};

const deleteTerm = async (req: Request, res: Response) => {
  const result = await TermService.deleteTerm(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Term deleted successfully.',
    data: result,
  });
};

const bulkUpdateTerms = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const { terms } = req.body;
  const result = await TermService.bulkUpdateTerms(terms, customReq.user?.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Terms updated in bulk successfully.',
    data: result,
  });
};

const resetToDefaults = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const result = await TermService.resetToDefaults(customReq.user?.userId);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Terms reset to defaults successfully.',
    data: result,
  });
};

export const TermController = {
  getPublicTerms,
  getAllTermsAdmin,
  createTerm,
  updateTerm,
  deleteTerm,
  bulkUpdateTerms,
  resetToDefaults,
};
