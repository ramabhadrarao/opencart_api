import express from 'express';
import { 
  startCheckout, 
  addShippingMethod, 
  addPaymentMethod,
  completeCheckout
} from '../controllers/checkout.controller.js';

import { applyCoupon } from '../controllers/coupon.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// All checkout routes require authentication
router.use(authenticateCustomer);

router.post('/start', startCheckout);
router.post('/shipping', addShippingMethod);
router.post('/payment', addPaymentMethod);
router.post('/complete', completeCheckout);

// Add coupon endpoint
router.post('/apply-coupon', applyCoupon);

export default router;