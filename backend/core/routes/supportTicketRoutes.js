import { Router } from 'express';
import * as controller from '../controllers/supportTicketController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { uploadSupport } from '../config/upload.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', validate(['subject', 'description']), controller.create);
router.get('/:id/messages', controller.messages);
router.post('/:id/messages', uploadSupport.single('attachment'), controller.addMessage);
router.patch('/:id', authorize('admin'), controller.update);
export default router;
