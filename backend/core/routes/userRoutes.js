import { Router } from 'express';
import * as controller from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadUser } from '../config/upload.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin'), controller.list);
router.route('/:id/avatar').patch(uploadUser.single('avatar'), controller.updateAvatar);
router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', authorize('admin'), controller.remove);
export default router;
