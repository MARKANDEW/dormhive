import { Router } from 'express';
import * as controller from '../controllers/bookingController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(authenticate);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.get('/:id/ticket', controller.ticket);
router.post('/', authorize('tenant'), validate(['propertyId', 'moveInDate', 'occupants']), controller.create);
router.patch('/:id/status', validate(['status']), controller.updateStatus);
export default router;
