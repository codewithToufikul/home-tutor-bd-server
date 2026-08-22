import type { IGenericErrorResponse, TErrorSources } from './error.interface.js';

export const handleDuplicateError = (err: { message?: string }): IGenericErrorResponse => {
  const match = err.message?.match(/"([^"]*)"/);
  const extractedMessage = match ? match[1] : '';

  const errorSources: TErrorSources = [
    {
      path: '',
      message: `${extractedMessage} already exists!`,
    },
  ];

  return {
    statusCode: 400,
    message: 'Duplicate field value entered',
    errors: errorSources,
  };
};
