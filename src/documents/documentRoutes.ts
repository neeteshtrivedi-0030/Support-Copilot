import { Router } from 'express';
import { documentController } from './documentController';
import { authenticate } from '../middleware/authenticate';
import { authorizeRoles } from '../middleware/authorize';
import { uploadSingleDocument } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { documentValidations } from './documentValidate';
import { UserRole } from '../enum';

const router = Router();

router.post(
  '/upload',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  uploadSingleDocument,
  validate(documentValidations.upload, 'body'),
  documentController.upload
);

router.get(
  '/',
  authenticate,
  validate(documentValidations.listQuery, 'query'),
  documentController.list
);

router.get(
  '/:id',
  authenticate,
  validate(documentValidations.documentIdParam, 'params'),
  documentController.getById
);

router.get(
  '/:id/download',
  authenticate,
  validate(documentValidations.documentIdParam, 'params'),
  documentController.download
);

router.delete(
  '/:id',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validate(documentValidations.documentIdParam, 'params'),
  documentController.delete
);

router.post(
  '/:id/retry',
  authenticate,
  authorizeRoles(UserRole.ADMIN),
  validate(documentValidations.documentIdParam, 'params'),
  documentController.retry
);

export const documentRoutes = router;
export default router;
