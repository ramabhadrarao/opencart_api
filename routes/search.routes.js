// routes/search.routes.js - ENHANCED
import express from 'express';
import searchController from '../controllers/search.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public search routes
router.get('/', searchController.searchProducts);
router.get('/suggestions', searchController.getSearchSuggestions);
router.get('/filters', searchController.getSearchFilters);
router.get('/popular', searchController.getPopularSearches);

// Admin analytics
router.get('/analytics', authenticateAdmin, searchController.getSearchAnalytics);

export default router;