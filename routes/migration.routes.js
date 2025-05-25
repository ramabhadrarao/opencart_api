// routes/migration.routes.js
import express from 'express';
import { migrationController } from '../controllers/migration.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All migration routes require admin authentication
router.use(authenticateAdmin);

router.get('/status', migrationController.getMigrationStatus);
router.get('/details/:name', migrationController.getMigrationDetails);
router.delete('/reset/:name', migrationController.resetMigrationStatus);

export default router;
