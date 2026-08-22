import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { ChatController } from './chat.controller.js';

const router = Router();

router.use(auth());

router.post('/conversations', ChatController.startConversation);
router.get('/conversations', ChatController.getMyConversations);
router.get('/conversations/:id/messages', ChatController.getConversationMessages);
router.patch('/conversations/:id/read', ChatController.markAsRead);

export const ChatRoutes = router;
