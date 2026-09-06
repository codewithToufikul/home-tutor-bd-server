import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { BlogController } from './blog.controller.js';

const router = Router();

// Public routes
router.get('/', BlogController.getAllBlogs);
router.get('/:id', BlogController.getBlogByIdOrSlug);

// Admin routes
router.post('/', auth('super_admin', 'admin', 'moderator'), BlogController.createBlog);
router.patch('/:id', auth('super_admin', 'admin', 'moderator'), BlogController.updateBlog);
router.delete('/:id', auth('super_admin', 'admin', 'moderator'), BlogController.deleteBlog);

export const BlogRoutes = router;
