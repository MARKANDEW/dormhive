import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, oauthCallback, oauthStart, passwordResetEmailStatus, register, requestPasswordResetEmail, resetPassword } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
import { uploadIdentityDocument } from '../config/upload.js';
const router = Router();
const passwordResetLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 50,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { message: 'Too many password reset attempts. Please try again later.' }
});
router.post('/register', uploadIdentityDocument.single('identityDocument'), validate(['first_name', 'last_name', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);
router.get('/password-reset/status', passwordResetEmailStatus);
router.post('/password-reset/request', passwordResetLimiter, validate(['email']), requestPasswordResetEmail);
router.post('/password-reset/confirm', validate(['token', 'password']), resetPassword);
router.post('/logout', logout);
router.get('/:provider/start', oauthStart);
router.get('/:provider/callback', oauthCallback);
export default router;
