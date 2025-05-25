// routes/cart.routes.js - ENHANCED
import express from 'express';
import cartController from '../controllers/cart.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// All cart routes require authentication
router.use(authenticateCustomer);

router.get('/', cartController.getCart);
router.get('/summary', cartController.getCartSummary);
router.post('/add', cartController.addToCart);
router.put('/update', cartController.updateCart);
router.delete('/remove/:item_id', cartController.removeFromCart);
router.delete('/clear', cartController.clearCart);

export default router;