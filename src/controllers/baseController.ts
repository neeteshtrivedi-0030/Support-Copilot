import { Response } from 'express';

export abstract class BaseController {
  protected success<T>(res: Response, data: T | null = null, message = 'Success'): Response {
    return res.success(data, message);
  }

  protected warn<T>(res: Response, data: T | null = null, message = 'Warning'): Response {
    return res.warn(data, message);
  }

  protected badRequest<T>(res: Response, data: T | null = null, message = 'Bad request'): Response {
    return res.badRequest(data, message);
  }

  protected unauthorized<T>(
    res: Response,
    data: T | null = null,
    message = 'Unauthorized'
  ): Response {
    return res.unauthorized(data, message);
  }

  protected forbidden<T>(res: Response, data: T | null = null, message = 'Forbidden'): Response {
    return res.forbidden(data, message);
  }

  protected notFound<T>(res: Response, data: T | null = null, message = 'Not found'): Response {
    return res.notFound(data, message);
  }

  protected serverError<T>(
    res: Response,
    data: T | null = null,
    message = 'Internal server error',
    err?: unknown
  ): Response {
    return res.serverError(data, message, err);
  }
}
