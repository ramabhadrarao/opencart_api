import express from 'express';
import {
  loginCustomer,
  getProfile,
  forgotPassword,
  resetPassword
} from '../controllers/customer.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/login', loginCustomer);
router.get('/profile', authenticateCustomer, getProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
