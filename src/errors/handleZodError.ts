import type { ZodError, ZodIssue } from 'zod';
import type { IGenericErrorResponse, TErrorSources } from './error.interface.js';

export const handleZodError = (err: ZodError): IGenericErrorResponse => {
  const errorSources: TErrorSources = err.issues.map((issue: ZodIssue) => {
    return {
      path: String(issue.path[issue.path.length - 1] ?? ''),
      message: issue.message,
    };
  });

  return {
    statusCode: 400,
    message: 'Validation failed',
    errors: errorSources,
  };
};
