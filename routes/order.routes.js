// routes/order.routes.js
import express from 'express';
import { getCustomerOrders } from '../controllers/order.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/my-orders', authenticateCustomer, getCustomerOrders);

export default router;
