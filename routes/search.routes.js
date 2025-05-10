// routes/search.routes.js
import express from 'express';
import { searchProducts, getSearchFilters } from '../controllers/search.controller.js';

const router = express.Router();

router.get('/', searchProducts);
router.get('/filters', getSearchFilters);

export default router;