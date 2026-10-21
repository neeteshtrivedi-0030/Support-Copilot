import { Router } from 'express';
import { authRoutes } from '../auth/authRoutes';
import { documentRoutes } from '../documents/documentRoutes';
import { adminRoutes } from '../analytics/adminRoutes';
import { chatRoutes } from '../chat/chatRoutes';
import { searchRoutes } from '../search/searchRoutes';
import { conversationRoutes } from '../chat/conversationRoutes';
import { healthController } from '../controllers/healthController';

const router = Router();

router.get('/', healthController.getRoot);
router.get('/health', healthController.getHealth);

router.use('/auth', authRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);
router.use('/chat', chatRoutes);
router.use('/search', searchRoutes);
router.use('/conversations', conversationRoutes);

export default router;
