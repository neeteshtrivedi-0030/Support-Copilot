import { Router } from 'express';
import { adminController } from './adminController';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { adminValidations } from './adminValidate';
import { authValidations } from '../auth/authValidate';
import { UserRole } from '../enum';

const router = Router();

router.get(
  '/users',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validate(adminValidations.userListQuery, 'query'),
  adminController.getUsers
);

router.post(
  '/users',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validate(authValidations.register, 'body'),
  adminController.createUser
);

router.get(
  '/analytics',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  adminController.getAnalytics
);

router.delete(
  '/documents/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validate(adminValidations.documentIdParam, 'params'),
  adminController.deleteDocument
);

export const adminRoutes = router;
export default router;
