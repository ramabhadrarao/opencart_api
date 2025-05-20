// routes/customer.routes.js
import express from 'express';
import customerController from '../controllers/customer.controller.js';
import { authenticateAdmin, authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', customerController.loginCustomer);
router.post('/register', customerController.registerCustomer);
router.post('/forgot-password', customerController.forgotPassword);
router.post('/reset-password', customerController.resetPassword);

// Customer profile routes (requires authentication)
router.get('/profile', authenticateCustomer, customerController.getProfile);
router.put('/profile', authenticateCustomer, customerController.updateProfile);
router.post('/change-password', authenticateCustomer, customerController.changePassword);

// Address routes (requires authentication)
router.get('/addresses', authenticateCustomer, customerController.getAddresses);
router.post('/address', authenticateCustomer, customerController.addAddress);
router.put('/address/:addressId', authenticateCustomer, customerController.updateAddress);
router.delete('/address/:addressId', authenticateCustomer, customerController.deleteAddress);
router.post('/address/:addressId/default', authenticateCustomer, customerController.setDefaultAddress);

// Admin-only routes
router.get('/', authenticateAdmin, customerController.getAllCustomers);
router.get('/:id', authenticateAdmin, customerController.getCustomerById);
router.post('/', authenticateAdmin, customerController.createCustomer);
router.put('/:id', authenticateAdmin, customerController.updateCustomer);
router.delete('/:id', authenticateAdmin, customerController.deleteCustomer);

export default router;