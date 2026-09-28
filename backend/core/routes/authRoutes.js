import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, oauthCallback, oauthStart, register, requestPasswordResetOtp, resetPassword, verifyPasswordResetOtp } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
const router = Router();
const passwordResetOtpLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 10,
	standardHeaders: 'draft-7',
	legacyHeaders: false,
	message: { message: 'Too many password reset attempts. Please try again later.' }
});
router.post('/register', validate(['first_name', 'last_name', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);
router.post('/password-reset/request-otp', passwordResetOtpLimiter, validate(['phone']), requestPasswordResetOtp);
router.post('/password-reset/verify-otp', passwordResetOtpLimiter, validate(['phone', 'code']), verifyPasswordResetOtp);
router.post('/password-reset/confirm', validate(['token', 'password']), resetPassword);
router.post('/logout', logout);
router.get('/:provider/start', oauthStart);
router.get('/:provider/callback', oauthCallback);
export default router;
