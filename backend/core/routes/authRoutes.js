import { Router } from 'express';
import { login, logout, register } from '../controllers/authController.js';
import { validate } from '../middleware/validate.js';
const router = Router();
router.post('/register', validate(['first_name', 'last_name', 'email', 'password']), register);
router.post('/login', validate(['email', 'password']), login);
router.post('/logout', logout);
export default router;
