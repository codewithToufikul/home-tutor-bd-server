import type { Request, Response } from 'express';
import type { CustomRequest } from '../../middlewares/auth.middleware.js';
import { sendResponse } from '../../utils/response.js';
import { BlogService } from './blog.service.js';

const createBlog = async (req: Request, res: Response) => {
  const customReq = req as CustomRequest;
  const result = await BlogService.createBlog(req.body, customReq.user?.userId);
  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: 'Blog post created successfully.',
    data: result,
  });
};

const getAllBlogs = async (req: Request, res: Response) => {
  const result = await BlogService.getAllBlogs(req.query);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blogs retrieved successfully.',
    data: result,
  });
};

const getBlogByIdOrSlug = async (req: Request, res: Response) => {
  const result = await BlogService.getBlogByIdOrSlug(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blog retrieved successfully.',
    data: result,
  });
};

const updateBlog = async (req: Request, res: Response) => {
  const result = await BlogService.updateBlog(String(req.params['id']), req.body);
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blog updated successfully.',
    data: result,
  });
};

const deleteBlog = async (req: Request, res: Response) => {
  const result = await BlogService.deleteBlog(String(req.params['id']));
  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: 'Blog deleted successfully.',
    data: result,
  });
};

export const BlogController = {
  createBlog,
  getAllBlogs,
  getBlogByIdOrSlug,
  updateBlog,
  deleteBlog,
};
