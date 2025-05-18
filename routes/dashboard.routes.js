// routes/dashboard.routes.js
import express from 'express';
import {
  getSalesRevenue,
  getNewOrders,
  getNewCustomers,
  getOnlineCustomers,
  getYearlyRevenue,
  getTopProducts,
  getRecentOrders
} from '../controllers/dashboard.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All dashboard routes require admin authentication
router.use(authenticateAdmin);

// Dashboard analytics routes
router.get('/sales', getSalesRevenue);
router.get('/orders/new', getNewOrders);
router.get('/customers/new', getNewCustomers);
router.get('/customers/online', getOnlineCustomers);
router.get('/revenue/yearly', getYearlyRevenue);
router.get('/products/top', getTopProducts);
router.get('/orders/recent', getRecentOrders);

export default router;