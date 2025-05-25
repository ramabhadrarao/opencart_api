// routes/order.routes.js - ENHANCED
import express from 'express';
import orderController from '../controllers/order.controller.js';
import { authenticateCustomer, authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Customer routes
router.get('/my-orders', authenticateCustomer, orderController.getCustomerOrders);
router.get('/details/:id', authenticateCustomer, orderController.getOrderDetails);

// Admin routes
router.get('/', authenticateAdmin, orderController.getAllOrders);
router.put('/status/:id', authenticateAdmin, orderController.updateOrderStatus);
router.get('/analytics', authenticateAdmin, orderController.getOrderAnalytics);
router.get('/statuses', orderController.getOrderStatuses);

export default router;