import { Request, Response, NextFunction } from 'express';
import { HttpResponseCode } from '../enum';

export const responseMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  res.success = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.OK).json({
      success: true,
      data,
      message,
    });
  };

  res.warn = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.OK).json({
      success: false,
      data,
      message,
    });
  };

  res.badRequest = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.BAD_REQUEST).json({
      success: false,
      data,
      message,
    });
  };

  res.unauthorized = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.UNAUTHORIZED).json({
      success: false,
      data,
      message,
    });
  };

  res.forbidden = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.FORBIDDEN).json({
      success: false,
      data,
      message,
    });
  };

  res.notFound = function (data: unknown = null, message = ''): Response {
    return this.status(HttpResponseCode.NOT_FOUND).json({
      success: false,
      data,
      message,
    });
  };

  res.serverError = function (data: unknown = null, message = '', err: unknown = null): Response {
    if (err) {
      console.error('[Server-Error]', err);
    }
    return this.status(HttpResponseCode.SERVER_ERROR).json({
      success: false,
      data,
      message,
    });
  };

  next();
};
