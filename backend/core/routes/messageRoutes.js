import { Router } from 'express';
import * as controller from '../controllers/messageController.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireApprovedVerification } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadMessage } from '../config/upload.js';

const router = Router();
router.use(authenticate);
router.get('/conversations', controller.listConversations);
router.get('/conversations/:id', controller.getConversation);
router.post('/conversations', requireApprovedVerification, controller.createConversation);
router.post('/', requireApprovedVerification, uploadMessage.single('attachment'), validate(['conversationId']), controller.send);
router.patch('/:id', controller.markRead);
router.delete('/:id', controller.remove);
export default router;
