// routes/upload.routes.js
import express from 'express';
import { getUploadedFile, getProductUploads } from '../controllers/upload.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// Route to download a file - requires authentication
router.get('/file/:filename', authenticateCustomer, getUploadedFile);

// Route to list uploads for a product - requires authentication
router.get('/product/:product_id', authenticateCustomer, getProductUploads);

export default router;