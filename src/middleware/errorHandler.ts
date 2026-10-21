import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/apiError';
import { env } from '../config/env';
import { IValidationErrorDetail } from '../types';

export const errorHandler: ErrorRequestHandler = (
  err: Error | ApiError | Joi.ValidationError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  if (err instanceof ApiError) {
    switch (err.statusCode) {
      case 400:
        res.badRequest(err.details ?? null, err.message);
        return;
      case 401:
        res.unauthorized(err.details ?? null, err.message);
        return;
      case 403:
        res.forbidden(err.details ?? null, err.message);
        return;
      case 404:
        res.notFound(err.details ?? null, err.message);
        return;
      case 500:
        res.serverError(err.details ?? null, err.message, err);
        return;
      default:
        res.warn(err.details ?? null, err.message);
        return;
    }
  }

  if (Joi.isError(err)) {
    const formattedErrors: IValidationErrorDetail[] = err.details.map((item) => ({
      field: item.path.join('.'),
      message: item.message.replace(/['"]/g, ''),
    }));

    res.badRequest(formattedErrors, 'Validation failed');
    return;
  }

  console.error('[Unhandled Error]', err);

  const message =
    env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';

  res.serverError(null, message, err);
};
