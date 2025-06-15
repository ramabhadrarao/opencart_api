// routes/product.routes.js - FIXED FOR EXPRESS 5
import express from 'express';
import productController from '../controllers/product.controller.js';
import { authenticateAdmin, authenticateCustomer, authenticateUser } from '../middleware/auth.middleware.js';
import { validateProduct, validateId, validatePagination } from '../middleware/validation.middleware.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      // Create upload directory based on product ID and option
      const productId = req.params.id || 'temp';
      const uploadDir = path.join(process.cwd(), 'catalog', 'files');
      
      // Ensure directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}${random}${req.params.id || 'temp'}${ext}`;
    
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow specific file types for product files
    const allowedTypes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: ZIP, PDF, images, documents'), false);
    }
  }
});

// Image upload configuration
const imageStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(process.cwd(), 'catalog', 'product');
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000000);
    const ext = path.extname(file.originalname);
    const filename = `${timestamp}${random}${req.params.id || 'temp'}${ext}`;
    
    cb(null, filename);
  }
});

const imageUpload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image type. Allowed: JPEG, PNG, GIF, WebP'), false);
    }
  }
});

// === PUBLIC ROUTES ===

// Get all products (public, but with some restrictions)
router.get('/', 
  validatePagination,
  productController.getAllProducts
);


// Get single product (public, but sanitized for non-customers)
router.get('/:id', 
  async (req, res, next) => {
    try {
      // Validate ID parameter
      const productId = parseInt(req.params.id);
      if (isNaN(productId) || productId <= 0) {
        return res.status(400).json({ 
          message: 'Invalid product ID. Must be a positive integer.' 
        });
      }
      
      // Optional authentication - don't fail if no token
      const token = req.headers['authorization']?.split(' ')[1];
      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          if (decoded.isAdmin) {
            req.admin = decoded;
          } else {
            req.customer = decoded;
          }
        } catch (authError) {
          // Ignore auth errors for public routes - just continue without auth
          console.log('Auth optional for product view:', authError.message);
        }
      }
      
      next();
    } catch (error) {
      res.status(500).json({ 
        message: 'Error processing request', 
        error: error.message 
      });
    }
  },
  productController.getProductById
);
// Get product images (public)
router.get('/:id/images',
  validateId,
  productController.getProductImages
);

// === CUSTOMER ROUTES (require customer authentication) ===

// 🔧 FIXED: Generate download link for purchased products
// ❌ OLD: router.get('/:productId/download/:optionValueId/link',
// ✅ NEW: Use proper parameter names
router.get('/:productId/download/:optionValueId/link',
  authenticateCustomer,
  async (req, res, next) => {
    req.params.id = req.params.productId; // For validation
    next();
  },
  validateId,
  productController.generateDownloadLink
);

// === ADMIN ROUTES (require admin authentication) ===

// Create new product
router.post('/',
  authenticateAdmin,
  validateProduct,
  productController.createProduct
);

// Update product
router.put('/:id',
  authenticateAdmin,
  validateId,
  productController.updateProduct
);

// Delete product
router.delete('/:id',
  authenticateAdmin,
  validateId,
  productController.deleteProduct
);

// === IMAGE MANAGEMENT ROUTES ===

// Upload product image
router.post('/:id/images',
  authenticateAdmin,
  validateId,
  imageUpload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No image file uploaded' });
      }
      
      // Add image to product
      req.body.image = `catalog/product/${req.file.filename}`;
      await productController.addProductImage(req, res);
    } catch (error) {
      res.status(500).json({ message: 'Error uploading image', error: error.message });
    }
  }
);

// Update product image
router.put('/:id/images/:imageId',
  authenticateAdmin,
  validateId,
  productController.updateProductImage
);

// Delete product image
router.delete('/:id/images/:imageId',
  authenticateAdmin,
  validateId,
  productController.deleteProductImage
);

// === OPTION MANAGEMENT ROUTES ===

// Add product option
router.post('/:id/options',
  authenticateAdmin,
  validateId,
  productController.addProductOption
);

// Update option
router.put('/:id/options/:optionId',
  authenticateAdmin,
  validateId,
  productController.updateProductOption
);

// Delete option
router.delete('/:id/options/:optionId',
  authenticateAdmin,
  validateId,
  productController.deleteProductOption
);

// Add option value with optional file upload
router.post('/:id/options/:optionId/values',
  authenticateAdmin,
  validateId,
  upload.single('uploaded_file'),
  async (req, res, next) => {
    try {
      // If file was uploaded, add file path to request body
      if (req.file) {
        req.body.uploaded_file = `catalog/files/${req.file.filename}`;
      }
      
      await productController.addProductOptionValue(req, res);
    } catch (error) {
      res.status(500).json({ message: 'Error adding option value', error: error.message });
    }
  }
);

// Update option value
router.put('/:id/options/:optionId/values/:valueId',
  authenticateAdmin,
  validateId,
  productController.updateProductOptionValue
);

// Delete option value
router.delete('/:id/options/:optionId/values/:valueId',
  authenticateAdmin,
  validateId,
  productController.deleteProductOptionValue
);

// === FILE DOWNLOAD ROUTES ===

// 🔧 FIXED: Download file with temporary token (public but protected)
// ❌ OLD: router.get('/download/*',
// ✅ NEW: Use named parameter
router.get('/download/:token',
  productController.downloadFile
);

// === ATTRIBUTE MANAGEMENT ROUTES ===

// Add product attribute
router.post('/:id/attributes',
  authenticateAdmin,
  validateId,
  productController.addProductAttribute
);

// Update product attribute
router.put('/:id/attributes/:attributeId',
  authenticateAdmin,
  validateId,
  productController.updateProductAttribute
);

// Delete product attribute
router.delete('/:id/attributes/:attributeId',
  authenticateAdmin,
  validateId,
  productController.deleteProductAttribute
);

// === DESCRIPTION MANAGEMENT ROUTES ===

// Update product description for specific language
router.put('/:id/descriptions/:languageId',
  authenticateAdmin,
  validateId,
  productController.updateProductDescription
);

// Delete product description for specific language
router.delete('/:id/descriptions/:languageId',
  authenticateAdmin,
  validateId,
  productController.deleteProductDescription
);

// === RELATED PRODUCTS ROUTES ===

// Add related product
router.post('/:id/related',
  authenticateAdmin,
  validateId,
  productController.addRelatedProduct
);

// Remove related product
router.delete('/:id/related/:relatedId',
  authenticateAdmin,
  validateId,
  productController.removeRelatedProduct
);

// === BULK OPERATIONS ===

// Bulk update products (admin only)
router.patch('/bulk',
  authenticateAdmin,
  async (req, res) => {
    try {
      const { product_ids, updates } = req.body;
      
      if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
        return res.status(400).json({ message: 'Product IDs array is required' });
      }
      
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ message: 'Updates object is required' });
      }
      
      // Limit bulk operations to prevent abuse
      if (product_ids.length > 100) {
        return res.status(400).json({ message: 'Maximum 100 products can be updated at once' });
      }
      
      updates.date_modified = new Date();
      
      const result = await Product.updateMany(
        { product_id: { $in: product_ids } },
        { $set: updates }
      );
      
      res.json({
        message: 'Bulk update completed',
        matched: result.matchedCount,
        modified: result.modifiedCount
      });
    } catch (error) {
      res.status(500).json({ message: 'Error in bulk update', error: error.message });
    }
  }
);

// === UTILITY ROUTES ===

// Get product statistics (admin only)
router.get('/stats/overview',
  authenticateAdmin,
  async (req, res) => {
    try {
      const totalProducts = await Product.countDocuments();
      const activeProducts = await Product.countDocuments({ status: true });
      const productsWithImages = await Product.countDocuments({ 
        $or: [
          { image: { $ne: null, $ne: '' } },
          { additional_images: { $ne: [] } }
        ]
      });
      const productsWithFiles = await Product.countDocuments({
        'options.values.uploaded_file': { $exists: true, $ne: '' }
      });
      
      res.json({
        total_products: totalProducts,
        active_products: activeProducts,
        inactive_products: totalProducts - activeProducts,
        products_with_images: productsWithImages,
        products_with_files: productsWithFiles,
        generated_at: new Date()
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching product statistics', error: error.message });
    }
  }
);

// === ADVANCED SEARCH ROUTES ===

// Advanced product search (admin only)
router.post('/search/advanced',
  authenticateAdmin,
  async (req, res) => {
    try {
      const {
        name,
        model,
        sku,
        category_ids,
        manufacturer_ids,
        price_range,
        stock_range,
        date_range,
        status,
        has_images,
        has_files,
        has_options,
        sort_by,
        sort_order,
        page = 1,
        limit = 20
      } = req.body;

      const query = {};
      
      // Text search
      if (name || model || sku) {
        const textConditions = [];
        if (name) textConditions.push({ 'descriptions.name': { $regex: name, $options: 'i' } });
        if (model) textConditions.push({ model: { $regex: model, $options: 'i' } });
        if (sku) textConditions.push({ sku: { $regex: sku, $options: 'i' } });
        
        if (textConditions.length > 0) {
          query.$or = textConditions;
        }
      }
      
      // Category filter
      if (category_ids && category_ids.length > 0) {
        query.categories = { $in: category_ids };
      }
      
      // Manufacturer filter
      if (manufacturer_ids && manufacturer_ids.length > 0) {
        query.manufacturer_id = { $in: manufacturer_ids };
      }
      
      // Price range
      if (price_range) {
        query.price = {};
        if (price_range.min !== undefined) query.price.$gte = price_range.min;
        if (price_range.max !== undefined) query.price.$lte = price_range.max;
      }
      
      // Stock range
      if (stock_range) {
        query.quantity = {};
        if (stock_range.min !== undefined) query.quantity.$gte = stock_range.min;
        if (stock_range.max !== undefined) query.quantity.$lte = stock_range.max;
      }
      
      // Date range
      if (date_range) {
        query.date_added = {};
        if (date_range.start) query.date_added.$gte = new Date(date_range.start);
        if (date_range.end) query.date_added.$lte = new Date(date_range.end);
      }
      
      // Status filter
      if (status !== undefined) {
        query.status = status;
      }
      
      // Has images filter
      if (has_images !== undefined) {
        if (has_images) {
          query.$or = [
            { image: { $ne: null, $ne: '' } },
            { additional_images: { $ne: [] } }
          ];
        } else {
          query.image = { $in: [null, ''] };
          query.additional_images = { $size: 0 };
        }
      }
      
      // Has files filter
      if (has_files !== undefined) {
        if (has_files) {
          query['options.values.uploaded_file'] = { $exists: true, $ne: '' };
        } else {
          query['options.values.uploaded_file'] = { $exists: false };
        }
      }
      
      // Has options filter
      if (has_options !== undefined) {
        if (has_options) {
          query.options = { $ne: [] };
        } else {
          query.options = { $size: 0 };
        }
      }
      
      // Sorting
      let sortQuery = { date_added: -1 }; // Default sort
      if (sort_by && sort_order) {
        sortQuery = { [sort_by]: sort_order === 'asc' ? 1 : -1 };
      }
      
      // Pagination
      const skip = (page - 1) * limit;
      
      const products = await Product.find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit);
      
      const total = await Product.countDocuments(query);
      
      res.json({
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        },
        query_used: query
      });
    } catch (error) {
      res.status(500).json({ message: 'Error in advanced search', error: error.message });
    }
  }
);

// === IMPORT/EXPORT ROUTES ===

// Export products to CSV (admin only)
router.get('/export/csv',
  authenticateAdmin,
  async (req, res) => {
    try {
      const products = await Product.find({});
      
      // Convert to CSV format
      const csvHeader = 'Product ID,Name,Model,SKU,Price,Quantity,Status,Date Added\n';
      const csvData = products.map(product => {
        const mainDesc = product.descriptions?.find(d => d.language_id === 1) || product.descriptions?.[0] || {};
        return [
          product.product_id,
          `"${mainDesc.name || ''}"`,
          `"${product.model || ''}"`,
          `"${product.sku || ''}"`,
          product.price || 0,
          product.quantity || 0,
          product.status ? 'Active' : 'Inactive',
          product.date_added?.toISOString().split('T')[0] || ''
        ].join(',');
      }).join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="products.csv"');
      res.send(csvHeader + csvData);
    } catch (error) {
      res.status(500).json({ message: 'Error exporting products', error: error.message });
    }
  }
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ message: 'Unexpected file field' });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({ message: error.message });
  }
  
  next(error);
});

export default router;