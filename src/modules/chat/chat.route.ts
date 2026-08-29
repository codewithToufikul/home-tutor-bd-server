import { Router } from 'express';
import { auth } from '../../middlewares/auth.middleware.js';
import { ChatController } from './chat.controller.js';

const router = Router();

router.use(auth());

router.post('/conversations', ChatController.startConversation);
router.get('/conversations', ChatController.getMyConversations);
router.get('/conversations/:id/messages', ChatController.getConversationMessages);
router.post('/conversations/:id/messages', ChatController.sendMessage);
router.patch('/conversations/:id/read', ChatController.markAsRead);
router.get('/contacts', ChatController.getContacts);
router.get('/users', ChatController.searchUsers);

export const ChatRoutes = router;
