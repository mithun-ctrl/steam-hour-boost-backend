import { Router } from 'express';
import { startSession, stopSession, startAll, stopAll, getActiveSessions } from '../controllers/session.controller.js';
import authenticate from '../middleware/auth.middleware.js';

const router = Router();

router.use(authenticate);

router.post('/:id/start', startSession);
router.post('/:id/stop', stopSession);
router.post('/start-all', startAll);
router.post('/stop-all', stopAll);
router.get('/active', getActiveSessions);

export default router;
