import { Router } from 'express';
import * as controller from '../controllers/propertyController.js';
import { authenticate, optionalAuthenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { upload } from '../config/upload.js';

const router = Router();
router.post('/uploads', authenticate, authorize('owner', 'admin'), upload.single('image'), controller.uploadImage);
router.get('/', optionalAuthenticate, controller.list);
router.get('/:id', optionalAuthenticate, controller.get);
const propertyImageUpload = upload.fields([{ name: 'images' }, { name: 'image' }]);
router.post('/', authenticate, authorize('owner', 'admin'), propertyImageUpload, validate(['title', 'address', 'municipality', 'roomType', 'monthlyRent', 'maxOccupants']), controller.create);
router.post('/:id/images', authenticate, authorize('owner', 'admin'), upload.single('image'), controller.addImage);
router.patch('/:id/status', authenticate, authorize('admin'), controller.changeStatus);
router.put('/:id', authenticate, authorize('owner', 'admin'), propertyImageUpload, controller.update);
router.patch('/:id', authenticate, authorize('owner', 'admin'), propertyImageUpload, controller.update);
router.delete('/:id', authenticate, controller.remove);
export default router;
