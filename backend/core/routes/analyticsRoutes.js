import { Router } from 'express';
import * as controller from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();
router.use(authenticate, authorize('admin'));
router.get('/users', controller.users);
router.get('/properties', controller.properties);
router.get('/bookings', controller.bookings);
export default router;
