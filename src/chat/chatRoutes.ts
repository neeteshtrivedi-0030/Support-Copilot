import { Router } from 'express';
import { chatController } from './chatController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { chatValidations } from './chatValidate';

const router = Router();

router.post('/', authenticate, validate(chatValidations.chat, 'body'), chatController.chat);
router.post(
  '/feedback',
  authenticate,
  validate(chatValidations.feedback, 'body'),
  chatController.feedback
);

export const chatRoutes = router;
export default router;
