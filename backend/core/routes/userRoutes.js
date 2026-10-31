import { Router } from 'express';
import * as controller from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadUser } from '../config/upload.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('admin'), controller.list);
router.get('/:id/verification-document', authorize('admin'), controller.verificationDocument);
router.patch('/:id/verification', authorize('admin'), controller.reviewVerification);
router.route('/:id/avatar').patch(uploadUser.single('avatar'), controller.updateAvatar);
router.patch('/:id/restore', authorize('admin'), controller.restore);
router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', authorize('admin'), controller.remove);
export default router;
