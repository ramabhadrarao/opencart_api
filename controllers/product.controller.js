// controllers/product.controller.js (complete CRUD)
import Product from '../models/product.model.js';
import mongoose from 'mongoose';
import auditLogService from '../utils/auditLogService.js';

// MAIN PRODUCT OPERATIONS

/**
 * Get all products with pagination and filters
 */
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Build query with various filters
    const filters = { status: req.query.status === 'false' ? false : true };
    
    if (req.query.category) {
      filters.categories = parseInt(req.query.category);
    }
    
    if (req.query.manufacturer) {
      filters.manufacturer_id = parseInt(req.query.manufacturer);
    }
    
    // Price range filter
    if (req.query.price_min || req.query.price_max) {
      filters.price = {};
      if (req.query.price_min) filters.price.$gte = parseFloat(req.query.price_min);
      if (req.query.price_max) filters.price.$lte = parseFloat(req.query.price_max);
    }
    
    // Search in name, model, description
    if (req.query.search) {
      filters.$or = [
        { 'descriptions.name': { $regex: req.query.search, $options: 'i' } },
        { model: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Determine sort order
    let sortOrder = {};
    switch (req.query.sort || 'date_added') {
      case 'name_asc':
        sortOrder = { 'descriptions.name': 1 };
        break;
      case 'name_desc':
        sortOrder = { 'descriptions.name': -1 };
        break;
      case 'price_asc':
        sortOrder = { price: 1 };
        break;
      case 'price_desc':
        sortOrder = { price: -1 };
        break;
      case 'date_added':
      default:
        sortOrder = { date_added: -1 };
    }
    
    const products = await Product.find(filters)
      .sort(sortOrder)
      .skip(skip)
      .limit(limit);
    
    const total = await Product.countDocuments(filters);
    
    // Format products for response
    const formattedProducts = products.map(product => {
      const mainDesc = product.descriptions?.find(d => d.language_id === 1) || product.descriptions?.[0] || {};
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || '',
        model: product.model,
        price: product.price,
        image: product.image,
        quantity: product.quantity,
        status: product.status,
        manufacturer_id: product.manufacturer_id,
        date_added: product.date_added
      };
    });
    
    res.json({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching products', error: err.message });
  }
};

/**
 * Get a product by ID
 */
export const getProductById = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching product', error: err.message });
  }
};

/**
 * Create a new product
 */
export const createProduct = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productData = req.body;
    
    // Get next product_id
    const lastProduct = await Product.findOne().sort({ product_id: -1 });
    const newProductId = lastProduct ? lastProduct.product_id + 1 : 1;
    
    // Set default timestamps
    const now = new Date();
    productData.product_id = newProductId;
    productData.date_added = now;
    productData.date_modified = now;
    
    // Ensure required fields
    if (!productData.model) {
      return res.status(400).json({ message: 'Product model is required' });
    }
    
    // Ensure descriptions has at least one entry
    if (!productData.descriptions || !productData.descriptions.length) {
      return res.status(400).json({ message: 'At least one product description is required' });
    }
    
    // Create the product
    const newProduct = new Product(productData);
    await newProduct.save();
    
    // Log this action
    auditLogService.logCreate(req, 'product', newProduct);
    
    res.status(201).json({
      message: 'Product created successfully',
      product_id: newProductId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating product', error: err.message });
  }
};

/**
 * Update a product
 */
export const updateProduct = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const updateData = req.body;
    
    // Get the existing product
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Save the original for auditing
    const originalProduct = product.toObject();
    
    // Update with provided fields except product_id
    delete updateData.product_id; // Never update the primary key
    
    // Update date_modified
    updateData.date_modified = new Date();
    
    // Update the product
    const updatedProduct = await Product.findOneAndUpdate(
      { product_id: productId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    // Log this action
    auditLogService.logUpdate(req, 'product', originalProduct, updatedProduct.toObject());
    
    res.json({
      message: 'Product updated successfully',
      product_id: productId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
};

/**
 * Delete a product
 */
export const deleteProduct = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    
    // Get product first for audit log
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Delete the product
    await Product.deleteOne({ product_id: productId });
    
    // Log this action
    auditLogService.logDelete(req, 'product', product.toObject());
    
    res.json({
      message: 'Product deleted successfully',
      product_id: productId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product', error: err.message });
  }
};

// PRODUCT DESCRIPTION OPERATIONS

/**
 * Add/update product description
 */
export const updateProductDescription = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const languageId = parseInt(req.params.languageId);
    const descriptionData = req.body;
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if description for this language already exists
    const descIndex = product.descriptions.findIndex(d => d.language_id === languageId);
    
    if (descIndex >= 0) {
      // Update existing description
      product.descriptions[descIndex] = {
        ...product.descriptions[descIndex],
        ...descriptionData,
        language_id: languageId
      };
    } else {
      // Add new description
      product.descriptions.push({
        language_id: languageId,
        ...descriptionData
      });
    }
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product description updated successfully',
      product_id: productId,
      language_id: languageId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product description', error: err.message });
  }
};

/**
 * Delete product description
 */
export const deleteProductDescription = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const languageId = parseInt(req.params.languageId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove description for this language
    product.descriptions = product.descriptions.filter(d => d.language_id !== languageId);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product description deleted successfully',
      product_id: productId,
      language_id: languageId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product description', error: err.message });
  }
};

// PRODUCT ATTRIBUTE OPERATIONS

/**
 * Add attribute to product
 */
export const addProductAttribute = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const attributeData = req.body;
    
    // Validate required fields
    if (!attributeData.attribute_id || !attributeData.name || !attributeData.text) {
      return res.status(400).json({ message: 'Attribute ID, name and text are required' });
    }
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Check if attribute already exists
    const existingAttr = product.attributes.find(a => a.attribute_id === attributeData.attribute_id);
    
    if (existingAttr) {
      return res.status(409).json({ message: 'Attribute already exists for this product' });
    }
    
    // Add attribute
    product.attributes.push(attributeData);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.status(201).json({
      message: 'Product attribute added successfully',
      product_id: productId,
      attribute_id: attributeData.attribute_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product attribute', error: err.message });
  }
};

/**
 * Update product attribute
 */
export const updateProductAttribute = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const attributeId = parseInt(req.params.attributeId);
    const attributeData = req.body;
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find attribute index
    const attrIndex = product.attributes.findIndex(a => a.attribute_id === attributeId);
    
    if (attrIndex === -1) {
      return res.status(404).json({ message: 'Attribute not found for this product' });
    }
    
    // Update attribute
    product.attributes[attrIndex] = {
      ...product.attributes[attrIndex],
      ...attributeData,
      attribute_id: attributeId
    };
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product attribute updated successfully',
      product_id: productId,
      attribute_id: attributeId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product attribute', error: err.message });
  }
};

/**
 * Delete product attribute
 */
export const deleteProductAttribute = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const attributeId = parseInt(req.params.attributeId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove attribute
    product.attributes = product.attributes.filter(a => a.attribute_id !== attributeId);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product attribute deleted successfully',
      product_id: productId,
      attribute_id: attributeId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product attribute', error: err.message });
  }
};

// PRODUCT OPTION OPERATIONS

/**
 * Add option to product
 */
export const addProductOption = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionData = req.body;
    
    // Validate required fields
    if (!optionData.option_id || !optionData.name || !optionData.type) {
      return res.status(400).json({ message: 'Option ID, name and type are required' });
    }
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get next product_option_id
    const maxOptionId = product.options.reduce((max, opt) => 
      opt.product_option_id > max ? opt.product_option_id : max, 0);
    const newOptionId = maxOptionId + 1;
    
    // Add option
    product.options.push({
      product_option_id: newOptionId,
      ...optionData,
      values: optionData.values || []
    });
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.status(201).json({
      message: 'Product option added successfully',
      product_id: productId,
      product_option_id: newOptionId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product option', error: err.message });
  }
};

/**
 * Update product option
 */
export const updateProductOption = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionId = parseInt(req.params.optionId);
    const optionData = req.body;
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find option index
    const optIndex = product.options.findIndex(o => o.product_option_id === optionId);
    
    if (optIndex === -1) {
      return res.status(404).json({ message: 'Option not found for this product' });
    }
    
    // Get the option values
    const existingValues = product.options[optIndex].values || [];
    
    // Update option (preserving values if not provided)
    product.options[optIndex] = {
      ...product.options[optIndex],
      ...optionData,
      product_option_id: optionId,
      values: optionData.values || existingValues
    };
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product option updated successfully',
      product_id: productId,
      product_option_id: optionId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product option', error: err.message });
  }
};

/**
 * Delete product option
 */
export const deleteProductOption = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionId = parseInt(req.params.optionId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove option
    product.options = product.options.filter(o => o.product_option_id !== optionId);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product option deleted successfully',
      product_id: productId,
      product_option_id: optionId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product option', error: err.message });
  }
};

// PRODUCT OPTION VALUE OPERATIONS

/**
 * Add option value to product option
 */
export const addProductOptionValue = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionId = parseInt(req.params.optionId);
    const valueData = req.body;
    
    // Validate required fields
    if (!valueData.option_value_id || !valueData.name) {
      return res.status(400).json({ message: 'Option value ID and name are required' });
    }
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find option index
    const optIndex = product.options.findIndex(o => o.product_option_id === optionId);
    
    if (optIndex === -1) {
      return res.status(404).json({ message: 'Option not found for this product' });
    }
    
    // Get next product_option_value_id
    const values = product.options[optIndex].values || [];
    const maxValueId = values.reduce((max, val) => 
      val.product_option_value_id > max ? val.product_option_value_id : max, 0);
    const newValueId = maxValueId + 1;
    
    // Add option value
    if (!product.options[optIndex].values) {
      product.options[optIndex].values = [];
    }
    
    product.options[optIndex].values.push({
      product_option_value_id: newValueId,
      ...valueData
    });
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.status(201).json({
      message: 'Product option value added successfully',
      product_id: productId,
      product_option_id: optionId,
      product_option_value_id: newValueId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product option value', error: err.message });
  }
};

/**
 * Update product option value
 */
export const updateProductOptionValue = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionId = parseInt(req.params.optionId);
    const valueId = parseInt(req.params.valueId);
    const valueData = req.body;
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find option index
    const optIndex = product.options.findIndex(o => o.product_option_id === optionId);
    
    if (optIndex === -1) {
      return res.status(404).json({ message: 'Option not found for this product' });
    }
    
    // Find value index
    const valueIndex = product.options[optIndex].values.findIndex(v => 
      v.product_option_value_id === valueId
    );
    
    if (valueIndex === -1) {
      return res.status(404).json({ message: 'Option value not found' });
    }
    
    // Update option value
    product.options[optIndex].values[valueIndex] = {
      ...product.options[optIndex].values[valueIndex],
      ...valueData,
      product_option_value_id: valueId
    };
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product option value updated successfully',
      product_id: productId,
      product_option_id: optionId,
      product_option_value_id: valueId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product option value', error: err.message });
  }
};

/**
 * Delete product option value
 */
export const deleteProductOptionValue = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const optionId = parseInt(req.params.optionId);
    const valueId = parseInt(req.params.valueId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find option index
    const optIndex = product.options.findIndex(o => o.product_option_id === optionId);
    
    if (optIndex === -1) {
      return res.status(404).json({ message: 'Option not found for this product' });
    }
    
    // Remove option value
    product.options[optIndex].values = product.options[optIndex].values.filter(v => 
      v.product_option_value_id !== valueId
    );
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product option value deleted successfully',
      product_id: productId,
      product_option_id: optionId,
      product_option_value_id: valueId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product option value', error: err.message });
  }
};

// PRODUCT IMAGE OPERATIONS

/**
 * Add image to product
 */
export const addProductImage = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const imageData = req.body;
    
    // Validate required fields
    if (!imageData.image) {
      return res.status(400).json({ message: 'Image path is required' });
    }
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get next product_image_id
    const maxImageId = product.additional_images.reduce((max, img) => 
      img.product_image_id > max ? img.product_image_id : max, 0);
    const newImageId = maxImageId + 1;
    
    // Add image
    product.additional_images.push({
      product_image_id: newImageId,
      image: imageData.image,
      sort_order: imageData.sort_order || 0
    });
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.status(201).json({
      message: 'Product image added successfully',
      product_id: productId,
      product_image_id: newImageId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product image', error: err.message });
  }
};

/**
 * Update product image
 */
export const updateProductImage = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    const imageData = req.body;
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find image index
    const imgIndex = product.additional_images.findIndex(i => i.product_image_id === imageId);
    
    if (imgIndex === -1) {
      return res.status(404).json({ message: 'Image not found for this product' });
    }
    
    // Update image
    product.additional_images[imgIndex] = {
      ...product.additional_images[imgIndex],
      ...imageData,
      product_image_id: imageId
    };
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product image updated successfully',
      product_id: productId,
      product_image_id: imageId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product image', error: err.message });
  }
};

/**
 * Delete product image
 */
export const deleteProductImage = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const imageId = parseInt(req.params.imageId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove image
    product.additional_images = product.additional_images.filter(i => 
      i.product_image_id !== imageId
    );
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.json({
      message: 'Product image deleted successfully',
      product_id: productId,
      product_image_id: imageId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product image', error: err.message });
  }
};

// RELATED PRODUCTS OPERATIONS

/**
 * Add related product
 */
export const addRelatedProduct = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const { related_id } = req.body;
    
    if (!related_id) {
      return res.status(400).json({ message: 'Related product ID is required' });
    }
    
    // Check if both products exist
    const product = await Product.findOne({ product_id: productId });
    const relatedProduct = await Product.findOne({ product_id: related_id });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    if (!relatedProduct) {
      return res.status(404).json({ message: 'Related product not found' });
    }
    
    // Check if already related
    if (product.related_products.includes(related_id)) {
      return res.status(409).json({ message: 'Products are already related' });
    }
    
    // Add related product
    product.related_products.push(related_id);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    // Also add reciprocal relation if not already present
    if (!relatedProduct.related_products.includes(productId)) {
      relatedProduct.related_products.push(productId);
      relatedProduct.date_modified = new Date();
      await relatedProduct.save();
    }
    
    res.status(201).json({
      message: 'Related product added successfully',
      product_id: productId,
      related_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding related product', error: err.message });
  }
};

/**
 * Remove related product
 */
export const removeRelatedProduct = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const productId = parseInt(req.params.id);
    const relatedId = parseInt(req.params.relatedId);
    
    // Check if product exists
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Remove related product
    product.related_products = product.related_products.filter(id => id !== relatedId);
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    // Also remove reciprocal relation
    const relatedProduct = await Product.findOne({ product_id: relatedId });
    
    if (relatedProduct) {
      relatedProduct.related_products = relatedProduct.related_products.filter(id => id !== productId);
      relatedProduct.date_modified = new Date();
      await relatedProduct.save();
    }
    
    res.json({
      message: 'Related product removed successfully',
      product_id: productId,
      related_id: relatedId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error removing related product', error: err.message });
  }
};

// Export all controllers
export default {
  // Main product operations
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  
  // Description operations
  updateProductDescription,
  deleteProductDescription,
  
  // Attribute operations
  addProductAttribute,
  updateProductAttribute,
  deleteProductAttribute,
  
  // Option operations
  addProductOption,
  updateProductOption,
  deleteProductOption,
  
  // Option value operations
  addProductOptionValue,
  updateProductOptionValue,
  deleteProductOptionValue,
  
  // Image operations
  addProductImage,
  updateProductImage,
  deleteProductImage,
  
  // Related product operations
  addRelatedProduct,
  removeRelatedProduct
};