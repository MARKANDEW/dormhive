import { Router } from 'express';
import * as controller from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.patch('/:id', controller.markRead);
export default router;
