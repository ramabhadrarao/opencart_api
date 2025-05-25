// routes/address.routes.js
import express from 'express';
import { addressController } from '../controllers/address.controller.js';
import { authenticateAdmin, authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

// Routes requiring authentication
router.get('/', authenticateAdmin, addressController.getAllAddresses);
router.get('/:id', authenticateUser, addressController.getAddressById);
router.post('/', authenticateAdmin, addressController.createAddress);

export default router;