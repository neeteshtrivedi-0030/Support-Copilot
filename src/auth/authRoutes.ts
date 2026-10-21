import { Router } from 'express';
import { authController } from './authController';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authenticate';
import { authValidations } from './authValidate';

const router = Router();

router.post('/register', validate(authValidations.register), authController.register);

router.post('/login', validate(authValidations.login), authController.login);

router.post('/logout', authenticate, authController.logout);

router.post('/refresh', authController.refreshToken);

export const authRoutes = router;
export default router;
