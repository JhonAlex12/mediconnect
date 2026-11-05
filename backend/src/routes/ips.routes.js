import { Router } from 'express';
import { exigirApiKeyIps } from '../middleware/apiKeyIps.js';
import { registrarFormula } from '../controllers/ips.controller.js';

const router = Router();

// POST /api/ips/formulas
router.post('/formulas', exigirApiKeyIps, registrarFormula);

export default router;