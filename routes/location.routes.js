// routes/location.routes.js
import express from 'express';
import {
  getCountries,
  getZonesByCountry
} from '../controllers/location.controller.js';

const router = express.Router();

router.get('/countries', getCountries);
router.get('/zones/:country_id', getZonesByCountry);

export default router;