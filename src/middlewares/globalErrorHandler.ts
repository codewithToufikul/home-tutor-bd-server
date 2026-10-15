import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError.js';

import type { TErrorSources } from '../errors/error.interface.js';
import { handleCastError } from '../errors/handleCastError.js';
import { handleDuplicateError } from '../errors/handleDuplicateError.js';
import { handleValidationError } from '../errors/handleValidationError.js';
import { handleZodError } from '../errors/handleZodError.js';

export const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let statusCode = 500;
  let message = 'Something went wrong!';
  let errorSources: TErrorSources = [
    {
      path: '',
      message: 'Something went wrong!',
    },
  ];

  if (err instanceof ZodError) {
    const simplifiedError = handleZodError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errors;
  } else if (err?.name === 'ValidationError') {
    const simplifiedError = handleValidationError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errors;
  } else if (err?.name === 'CastError') {
    const simplifiedError = handleCastError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errors;
  } else if (err?.code === 11000) {
    const simplifiedError = handleDuplicateError(err);
    statusCode = simplifiedError.statusCode;
    message = simplifiedError.message;
    errorSources = simplifiedError.errors;
  } else if (err?.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'jwt expired';
    errorSources = [
      {
        path: '',
        message: 'Access token has expired. Please refresh your token.',
      },
    ];
  } else if (err?.name === 'JsonWebTokenError' || err?.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Invalid token';
    errorSources = [
      {
        path: '',
        message: 'Authentication token is invalid or corrupted. Please log in again.',
      },
    ];
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    errorSources = [
      {
        path: '',
        message: err.message,
      },
    ];
  } else if (err instanceof Error) {
    message = err.message;
    errorSources = [
      {
        path: '',
        message: err.message,
      },
    ];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errorSources,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
  });
};
