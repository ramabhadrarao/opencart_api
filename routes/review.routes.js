// routes/review.routes.js
import express from 'express';
import {
  getProductReviews,
  addReview
} from '../controllers/review.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/product/:product_id', getProductReviews);

// Protected routes
router.post('/add', authenticateCustomer, addReview);

export default router;