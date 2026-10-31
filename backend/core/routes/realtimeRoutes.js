import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { subscribeToDataChanges } from '../services/realtimeEvents.js';

const router = Router();

router.get('/', authenticate, (request, response) => {
  response.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  response.flushHeaders();
  response.write('retry: 3000\n\n');

  const unsubscribe = subscribeToDataChanges(response, request.get('x-dormhive-client') ?? '');
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 25000);
  response.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;