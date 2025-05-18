// routes/coupon.routes.js
import express from 'express';
import {
  getAllCoupons,
  getCouponByCode,
  createCoupon,
  updateCoupon,
  deleteCoupon
} from '../controllers/coupon.controller.js';

import { 
  authenticateAdmin, 
  authenticateCustomer, 
  authenticateUser 
} from '../middleware/auth.middleware.js';

const router = express.Router();

// Admin-only routes - all require admin authentication
router.get('/', authenticateAdmin, getAllCoupons);
router.post('/', authenticateAdmin, createCoupon);
router.put('/:id', authenticateAdmin, updateCoupon);
router.delete('/:id', authenticateAdmin, deleteCoupon);

// Public/Customer routes
router.get('/:code', authenticateUser, getCouponByCode); // Works for both customer and admin

export default router;