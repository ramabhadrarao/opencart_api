// routes/system.routes.js
import express from 'express';
import { systemController } from '../controllers/system.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public health check
router.get('/health', systemController.getHealthCheck);

// Admin routes
router.get('/overview', authenticateAdmin, systemController.getSystemOverview);

export default router;