import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Application, type NextFunction, type Request, type Response } from 'express';
import { AppError } from './errors/AppError.js';
import { AdminRoutes } from './modules/admin/admin.route.js';
import { ApplicationRoutes } from './modules/application/application.route.js';
import { AuthRoutes } from './modules/auth/auth.route.js';
import { HireRoutes } from './modules/hire/hire.route.js';
import { TuitionRoutes } from './modules/tuition/tuition.route.js';
import { TutorRoutes } from './modules/tutor/tutor.route.js';

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
      admin: '/api/v1/admin',
    },
  });
});

// Application Routes
app.use('/api/v1/auth', AuthRoutes);
app.use('/api/v1/tutors', TutorRoutes);
app.use('/api/v1/tuition-jobs', TuitionRoutes);
app.use('/api/v1/applications', ApplicationRoutes);
app.use('/api/v1/hire-requests', HireRoutes);
app.use('/api/v1/admin', AdminRoutes);

// Global 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'API Endpoint Not Found!',
  });
});

// Global Error Handler Middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error!';

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err : undefined,
  });
});

export default app;
