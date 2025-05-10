// routes/product.routes.js
import express from 'express';
import { 
  getAllProducts, 
  getProductById, 
  getPurchasedProducts 
} from '../controllers/product.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes
router.get('/purchased', authenticateCustomer, getPurchasedProducts);

export default router;