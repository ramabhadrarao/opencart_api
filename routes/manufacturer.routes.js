// routes/manufacturer.routes.js
import express from 'express';
import manufacturerController from '../controllers/manufacturer.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import auditLogService from '../utils/auditLogService.js'; // ADD THIS

const router = express.Router();

router.get('/', manufacturerController.getAllManufacturers);
router.get('/:id', manufacturerController.getManufacturerById);
router.post('/', authenticateAdmin, manufacturerController.createManufacturer);
router.put('/:id', authenticateAdmin, manufacturerController.updateManufacturer);
router.delete('/:id', authenticateAdmin, manufacturerController.deleteManufacturer);

export default router;