// routes/category.routes.js - ENHANCED
import express from 'express';
import categoryController from '../controllers/category.controller.js';

const router = express.Router();

router.get('/', categoryController.getAllCategories);
router.get('/tree', categoryController.getCategoryTree);
router.get('/top', categoryController.getTopCategories);
router.get('/search', categoryController.searchCategories);
router.get('/:id', categoryController.getCategoryById);
router.get('/:id/path', categoryController.getCategoryPath);

export default router;