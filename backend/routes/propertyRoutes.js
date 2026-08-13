import { Router } from 'express';
import * as controller from '../controllers/propertyController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../config/upload.js';

const router = Router();
router.get('/', optionalAuthenticate, controller.list);
router.get('/:id', optionalAuthenticate, controller.get);
router.post('/', authenticate, authorize('owner', 'admin'), upload.single('image'), validate(['title', 'address', 'municipality', 'roomType', 'monthlyRent', 'maxOccupants']), controller.create);
router.patch('/:id/status', authenticate, authorize('admin'), controller.changeStatus);
router.patch('/:id', authenticate, controller.update);
router.delete('/:id', authenticate, controller.remove);
export default router;
