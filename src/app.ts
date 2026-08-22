import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type Request, type Response } from 'express';
import { globalErrorHandler } from './middlewares/globalErrorHandler.js';
import { AdminRoutes } from './modules/admin/admin.route.js';
import { CoachingRoutes } from './modules/coaching/coaching.route.js';
import { EnrollmentRoutes } from './modules/enrollment/enrollment.route.js';
import { ApplicationRoutes } from './modules/application/application.route.js';
import { AuthRoutes } from './modules/auth/auth.route.js';
import { ChatRoutes } from './modules/chat/chat.route.js';
import { HireRoutes } from './modules/hire/hire.route.js';
import { NotificationRoutes } from './modules/notification/notification.route.js';
import { TuitionRoutes } from './modules/tuition/tuition.route.js';
import { TutorRoutes } from './modules/tutor/tutor.route.js';
import { UploadRoutes } from './modules/upload/upload.route.js';

const app: Application = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Root API Endpoint
app.get('/api/v1', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: '🏠 Home Tutor BD Server API v1 is running smoothly!',
    endpoints: {
      auth: '/api/v1/auth',
      tutors: '/api/v1/tutors',
      tuitionJobs: '/api/v1/tuition-jobs',
      applications: '/api/v1/applications',
      hireRequests: '/api/v1/hire-requests',
      chat: '/api/v1/chat',
      notifications: '/api/v1/notifications',
      upload: '/api/v1/upload',
      admin: '/api/v1/admin',
      coaching: '/api/v1/coaching',
    },
  });
});

// Application Routes
app.use('/api/v1/auth', AuthRoutes);
app.use('/api/v1/tutors', TutorRoutes);
app.use('/api/v1/tuition-jobs', TuitionRoutes);
app.use('/api/v1/applications', ApplicationRoutes);
app.use('/api/v1/hire-requests', HireRoutes);
app.use('/api/v1/chat', ChatRoutes);
app.use('/api/v1/notifications', NotificationRoutes);
app.use('/api/v1/upload', UploadRoutes);
app.use('/api/v1/admin', AdminRoutes);
app.use('/api/v1/coaching', CoachingRoutes);
app.use('/api/v1/enrollments', EnrollmentRoutes);

// Global 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API Endpoint Not Found!',
    errors: [
      {
        path: '',
        message: 'Requested route does not exist on this server.',
      },
    ],
  });
});

// Global Error Handler Middleware
app.use(globalErrorHandler);

export default app;
