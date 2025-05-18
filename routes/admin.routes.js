// routes/admin.routes.js
import express from 'express';
import { 
  loginAdmin, 
  getProfile, 
  updateAdmin, 
  changePassword, 
  getAllAdmins 
} from '../controllers/admin.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.post('/login', loginAdmin);

// Protected routes (require authentication)
router.get('/profile', authenticateAdmin, getProfile);
router.put('/update/:id', authenticateAdmin, updateAdmin);
router.post('/change-password', authenticateAdmin, changePassword);
router.get('/all', authenticateAdmin, getAllAdmins);

export default router;