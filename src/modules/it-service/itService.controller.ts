import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { ITServiceLogic } from './itService.service.js';

const createService = async (req: CustomRequest, res: Response) => {
  const result = await ITServiceLogic.createService(req.body, req.user!.userId);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'IT Service created successfully.',
    data: result,
  });
};

const getAllServices = async (req: Request, res: Response) => {
  const result = await ITServiceLogic.getAllServices(req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'IT Services retrieved successfully.',
    data: result,
  });
};

const getServiceById = async (req: Request, res: Response) => {
  const result = await ITServiceLogic.getServiceById(String(req.params['id']));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'IT Service details retrieved successfully.',
    data: result,
  });
};

const updateService = async (req: CustomRequest, res: Response) => {
  const result = await ITServiceLogic.updateService(String(req.params['id']), req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'IT Service updated successfully.',
    data: result,
  });
};

const deleteService = async (req: CustomRequest, res: Response) => {
  const result = await ITServiceLogic.deleteService(String(req.params['id']));

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'IT Service deleted successfully.',
    data: result,
  });
};

export const ITServiceController = {
  createService,
  getAllServices,
  getServiceById,
  updateService,
  deleteService,
};
