// routes/search.routes.js
import express from 'express';
import { 
  searchProducts, 
  getSearchFilters,
  getPopularSearches
} from '../controllers/search.controller.js';

const router = express.Router();

router.get('/', searchProducts);
router.get('/filters', getSearchFilters);
router.get('/popular', getPopularSearches); // New endpoint

export default router;