// routes/wishlist.routes.js
import express from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist
} from '../controllers/wishlist.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticateCustomer);

router.get('/', getWishlist);
router.post('/add', addToWishlist);
router.delete('/remove/:product_id', removeFromWishlist);

export default router;