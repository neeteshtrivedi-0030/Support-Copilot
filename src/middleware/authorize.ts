import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../enum';

export const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.unauthorized(null, req.__('UNAUTHORIZED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.forbidden(null, req.__('FORBIDDEN'));
      return;
    }

    next();
  };
};

export default authorizeRoles;
