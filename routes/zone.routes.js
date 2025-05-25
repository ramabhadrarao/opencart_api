// routes/zone.routes.js
import express from 'express';
import { zoneController } from '../controllers/zone.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', zoneController.getAllZones);
router.get('/country/:country_id', zoneController.getZonesByCountry);

// Admin routes
router.post('/', authenticateAdmin, zoneController.createZone);
// Add these routes:
router.put('/:id', authenticateAdmin, zoneController.updateZone);
router.delete('/:id', authenticateAdmin, zoneController.deleteZone);
export default router;