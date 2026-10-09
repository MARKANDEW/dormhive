import { Router } from 'express';
import { get } from '../controllers/mediaController.js';
import { authenticateMedia } from '../middleware/authenticate.js';

const router = Router();
router.get('/:id', authenticateMedia, get);
export default router;
