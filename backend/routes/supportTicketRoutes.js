import { Router } from 'express';
import * as controller from '../controllers/supportTicketController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.post('/', validate(['subject', 'description']), controller.create);
router.patch('/:id', authorize('admin'), controller.update);
export default router;
