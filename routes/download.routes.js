// routes/download.routes.js
import express from 'express';
import { getDownloadableProducts, downloadFile } from '../controllers/download.controller.js';
import { authenticateCustomer } from '../middleware/auth.middleware.js';

const router = express.Router();

// All download routes require authentication
router.use(authenticateCustomer);

router.get('/products', getDownloadableProducts);
router.get('/file/:downloadId', downloadFile);

export default router;