import { Router } from 'express';
import * as controller from '../controllers/messageController.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversation);
router.post('/conversations', controller.createConversation);
router.post('/', validate(['conversationId', 'body']), controller.send);
router.patch('/:id', controller.markRead);
router.delete('/:id', controller.remove);
export default router;
