// routes/product.routes.js (complete CRUD routes)
import express from 'express';
import productController from '../controllers/product.controller.js';
import { authenticateAdmin, authenticateUser } from '../middleware/auth.middleware.js';

const router = express.Router();

// Main product routes
router.get('/', productController.getAllProducts);
router.get('/:id', productController.getProductById);

// Admin-only routes for CRUD operations
router.post('/', authenticateAdmin, productController.createProduct);
router.put('/:id', authenticateAdmin, productController.updateProduct);
router.delete('/:id', authenticateAdmin, productController.deleteProduct);

// Description routes
router.put('/:id/descriptions/:languageId', authenticateAdmin, productController.updateProductDescription);
router.delete('/:id/descriptions/:languageId', authenticateAdmin, productController.deleteProductDescription);

// Attribute routes
router.post('/:id/attributes', authenticateAdmin, productController.addProductAttribute);
router.put('/:id/attributes/:attributeId', authenticateAdmin, productController.updateProductAttribute);
router.delete('/:id/attributes/:attributeId', authenticateAdmin, productController.deleteProductAttribute);

// Option routes
router.post('/:id/options', authenticateAdmin, productController.addProductOption);
router.put('/:id/options/:optionId', authenticateAdmin, productController.updateProductOption);
router.delete('/:id/options/:optionId', authenticateAdmin, productController.deleteProductOption);

// Option value routes
router.post('/:id/options/:optionId/values', authenticateAdmin, productController.addProductOptionValue);
router.put('/:id/options/:optionId/values/:valueId', authenticateAdmin, productController.updateProductOptionValue);
router.delete('/:id/options/:optionId/values/:valueId', authenticateAdmin, productController.deleteProductOptionValue);

// Image routes
router.post('/:id/images', authenticateAdmin, productController.addProductImage);
router.put('/:id/images/:imageId', authenticateAdmin, productController.updateProductImage);
router.delete('/:id/images/:imageId', authenticateAdmin, productController.deleteProductImage);

// Related product routes
router.post('/:id/related', authenticateAdmin, productController.addRelatedProduct);
router.delete('/:id/related/:relatedId', authenticateAdmin, productController.removeRelatedProduct);

export default router;