// routes/backup.routes.js
import express from 'express';
import {
  createBackupHandler,
  restoreBackupHandler,
  getBackupsHandler,
  deleteBackupHandler
} from '../controllers/backup.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All backup routes require admin authentication
router.use(authenticateAdmin);

// Get list of backups
router.get('/', getBackupsHandler);

// Create new backup
router.post('/', createBackupHandler);

// Restore from backup
router.post('/restore/:backupName', restoreBackupHandler);

// Delete a backup
router.delete('/:backupName', deleteBackupHandler);

export default router;