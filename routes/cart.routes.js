// routes/cart.routes.js
import express from 'express';
import { 
  getCart, 
  addToCart, 
  updateCart, 
  removeFromCart, 
  clearCart 
} from '../controllers/cart.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// All cart routes require authentication
router.use(authenticateCustomer);

router.get('/', getCart);
router.post('/add', addToCart);
router.put('/update', updateCart);
router.delete('/remove/:item_id', removeFromCart);
router.delete('/clear', clearCart);

export default router;