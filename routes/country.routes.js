// routes/country.routes.js
import express from 'express';
import countryController from '../controllers/country.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', countryController.getAllCountries);
router.get('/:id', countryController.getCountryById);

// Admin routes
router.post('/', authenticateAdmin, countryController.createCountry);
router.put('/:id', authenticateAdmin, countryController.updateCountry);
router.delete('/:id', authenticateAdmin, countryController.deleteCountry);

export default router;