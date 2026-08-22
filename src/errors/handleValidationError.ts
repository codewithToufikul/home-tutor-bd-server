import type mongoose from 'mongoose';
import type { IGenericErrorResponse, TErrorSources } from './error.interface.js';

export const handleValidationError = (
  err: mongoose.Error.ValidationError,
): IGenericErrorResponse => {
  const errorSources: TErrorSources = Object.values(err.errors).map(
    (val: mongoose.Error.ValidatorError | mongoose.Error.CastError) => {
      return {
        path: val?.path,
        message: val?.message,
      };
    },
  );

  return {
    statusCode: 400,
    message: 'Validation failed',
    errors: errorSources,
  };
};
