import { Request, Response } from 'express';

export const notFoundHandler = (req: Request, res: Response): void => {
  res.notFound(null, `Cannot ${req.method} ${req.originalUrl} - Route not found`);
};
