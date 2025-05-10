// routes/manufacturer.routes.js
import express from 'express';
import {
  getAllManufacturers,
  getManufacturerById
} from '../controllers/manufacturer.controller.js';

const router = express.Router();

router.get('/', getAllManufacturers);
router.get('/:id', getManufacturerById);

export default router;