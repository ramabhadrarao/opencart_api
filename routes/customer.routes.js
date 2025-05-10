// routes/customer.routes.js (updated)
import express from 'express';
import {
  loginCustomer,
  registerCustomer,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  getAddresses,
  addAddress,
  refreshToken
} from '../controllers/customer.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();
router.get('/', (req, res) => {
  res.json({ message: 'Customer routes working!' });
});
// Public routes
router.post('/login', loginCustomer);
router.post('/register', registerCustomer);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);

// Protected routes (require authentication)
router.get('/profile', authenticateCustomer, getProfile);
router.put('/profile', authenticateCustomer, updateProfile);
router.post('/change-password', authenticateCustomer, changePassword);
router.get('/addresses', authenticateCustomer, getAddresses);
router.post('/address', authenticateCustomer, addAddress);

export default router;