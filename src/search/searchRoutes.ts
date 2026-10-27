import { Router } from 'express';
import { chatController } from '../chat/chatController';
import { authenticate } from '../middleware/authenticate';
import { aiRateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { chatValidations } from '../chat/chatValidate';

const router = Router();

router.post(
  '/',
  authenticate,
  aiRateLimiter,
  validate(chatValidations.search, 'body'),
  chatController.search
);

export const searchRoutes = router;
export default router;
