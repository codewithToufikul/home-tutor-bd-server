import type mongoose from 'mongoose';
import type { IGenericErrorResponse, TErrorSources } from './error.interface.js';

export const handleCastError = (
  err: mongoose.Error.CastError,
): IGenericErrorResponse => {
  const errorSources: TErrorSources = [
    {
      path: err.path,
      message: `Invalid ${err.path}: ${err.value}`,
    },
  ];

  return {
    statusCode: 400,
    message: 'Invalid ID format',
    errors: errorSources,
  };
};
