import { Router } from 'express';
import { conversationController } from './conversationController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { conversationValidations } from './conversationValidate';

const router = Router();

router.get(
  '/',
  authenticate,
  validate(conversationValidations.listQuery, 'query'),
  conversationController.list
);

router.get(
  '/:id',
  authenticate,
  validate(conversationValidations.conversationIdParam, 'params'),
  conversationController.getById
);

router.delete(
  '/:id',
  authenticate,
  validate(conversationValidations.conversationIdParam, 'params'),
  conversationController.delete
);

router.patch(
  '/:id',
  authenticate,
  validate(conversationValidations.conversationIdParam, 'params'),
  validate(conversationValidations.renameConversation, 'body'),
  conversationController.rename
);

export const conversationRoutes = router;
export default router;
