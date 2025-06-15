// controllers/product.controller.js - COMPLETE WITH FILE MANAGEMENT
import Product from '../models/product.model.js';
import Customer from '../models/customer.model.js';
import Order from '../models/order.model.js';
import mongoose from 'mongoose';
import auditLogService from '../utils/auditLogService.js';
import { getNextProductId } from '../utils/idGenerator.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

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
        date_added: product.date_added,
        has_options: product.options && product.options.length > 0,
        has_uploaded_files: product.options && product.options.some(opt => 
          opt.values && opt.values.some(val => val.uploaded_file)
        )
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
 * Get a product by ID with full details
 */
export const getProductById = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Increment view count
    product.viewed = (product.viewed || 0) + 1;
    await product.save();

    // Format response based on user type
    let responseProduct = product.toObject();

    // For non-authenticated users, hide uploaded file details
    if (!req.customer && !req.admin) {
      responseProduct = await sanitizeProductForPublic(responseProduct);
    }
    
    res.json(responseProduct);
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
    
    // Get next product_id using ID generator
    const newProductId = await getNextProductId();
    
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
    auditLogService.logCreate(req, 'product', newProduct.toObject());
    
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
 * Add option value to product option with file upload support
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
    
    // Handle uploaded file if present
    let uploadedFile = valueData.uploaded_file || '';
    
    // Add option value
    if (!product.options[optIndex].values) {
      product.options[optIndex].values = [];
    }
    
    product.options[optIndex].values.push({
      product_option_value_id: newValueId,
      ...valueData,
      uploaded_file: uploadedFile
    });
    
    // Update the product
    product.date_modified = new Date();
    await product.save();
    
    res.status(201).json({
      message: 'Product option value added successfully',
      product_id: productId,
      product_option_id: optionId,
      product_option_value_id: newValueId,
      uploaded_file: uploadedFile
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
      product_image_id: newImageId,
      image_url: `/image/${imageData.image}`
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding product image', error: err.message });
  }
};

/**
 * Get product images
 */
export const getProductImages = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const images = [
      // Main image
      ...(product.image ? [{
        product_image_id: 0,
        image: product.image,
        sort_order: 0,
        is_main: true,
        image_url: `/image/${product.image}`
      }] : []),
      // Additional images
      ...product.additional_images.map(img => ({
        ...img,
        is_main: false,
        image_url: `/image/${img.image}`
      }))
    ];
    
    res.json({
      product_id: productId,
      images,
      total: images.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching product images', error: err.message });
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

// FILE DOWNLOAD OPERATIONS

/**
 * Generate temporary download link for purchased product files
 */
export const generateDownloadLink = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const productId = parseInt(req.params.productId);
    const optionValueId = parseInt(req.params.optionValueId);
    
    // Check if customer has purchased this product
    const hasPurchased = await verifyCustomerPurchase(customerId, productId);
    
    if (!hasPurchased) {
      return res.status(403).json({ 
        message: 'You must purchase this product to download files' 
      });
    }
    
    // Find the product and option value
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    let uploadedFile = null;
    
    for (const option of product.options) {
      if (option.values) {
        const value = option.values.find(v => v.product_option_value_id === optionValueId);
        if (value && value.uploaded_file) {
          uploadedFile = value.uploaded_file;
          break;
        }
      }
    }
    
    if (!uploadedFile) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Generate temporary token (expires in 30 minutes)
    const token = generateTemporaryToken(customerId, productId, optionValueId);
    
    res.json({
      download_url: `/api/products/download/${token}`,
      expires_in: 1800, // 30 minutes in seconds
      file_name: path.basename(uploadedFile)
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating download link', error: err.message });
  }
};

/**
 * Download file with temporary token
 */
export const downloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    
    // Verify and decode token
    const tokenData = verifyTemporaryToken(token);
    
    if (!tokenData) {
      return res.status(403).json({ message: 'Invalid or expired download token' });
    }
    
    const { customerId, productId, optionValueId } = tokenData;
    
    // Verify customer still has access
    const hasPurchased = await verifyCustomerPurchase(customerId, productId);
    
    if (!hasPurchased) {
      return res.status(403).json({ 
        message: 'Access denied - purchase verification failed' 
      });
    }
    
    // Find the file
    const product = await Product.findOne({ product_id: productId });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    let uploadedFile = null;
    
    for (const option of product.options) {
      if (option.values) {
        const value = option.values.find(v => v.product_option_value_id === optionValueId);
        if (value && value.uploaded_file) {
          uploadedFile = value.uploaded_file;
          break;
        }
      }
    }
    
    if (!uploadedFile) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Construct file path
    const catalogDir = path.join(process.cwd(), 'catalog');
    const filePath = path.join(catalogDir, uploadedFile);
    
    try {
      // Check if file exists
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ message: 'Physical file not found' });
    }
    
    // Set appropriate headers for download
    const fileName = path.basename(uploadedFile);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Stream the file
    const fileStream = require('fs').createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (err) {
    res.status(500).json({ message: 'Error downloading file', error: err.message });
  }
};

// HELPER FUNCTIONS

/**
 * Verify if customer has purchased a product
 */
async function verifyCustomerPurchase(customerId, productId) {
  try {
    // Check if customer has completed orders containing this product
    const order = await Order.findOne({
      customer_id: customerId,
      order_status_id: { $in: [3, 5] }, // Shipped or Complete
      'products.product_id': productId
    });
    
    return !!order;
  } catch (error) {
    console.error('Error verifying purchase:', error);
    return false;
  }
}

/**
 * Generate temporary download token
 */
function generateTemporaryToken(customerId, productId, optionValueId) {
  const data = {
    customerId,
    productId,
    optionValueId,
    expires: Date.now() + (30 * 60 * 1000) // 30 minutes
  };
  
  const token = Buffer.from(JSON.stringify(data)).toString('base64');
  return crypto.createHash('sha256').update(token).digest('hex').substring(0, 32) + '.' + token;
}

/**
 * Verify temporary download token
 */
function verifyTemporaryToken(token) {
  try {
    const [hash, encodedData] = token.split('.');
    
    // Verify hash
    const expectedHash = crypto.createHash('sha256').update(encodedData).digest('hex').substring(0, 32);
    
    if (hash !== expectedHash) {
      return null;
    }
    
    // Decode data
    const data = JSON.parse(Buffer.from(encodedData, 'base64').toString());
    
    // Check expiration
    if (Date.now() > data.expires) {
      return null;
    }
    
    return data;
  } catch (error) {
    return null;
  }
}

/**
 * Sanitize product data for public viewing (hide file details)
 */
async function sanitizeProductForPublic(product) {
  if (product.options) {
    product.options = product.options.map(option => ({
      ...option,
      values: option.values ? option.values.map(value => ({
        ...value,
        uploaded_file: value.uploaded_file ? 'protected_file' : undefined
      })) : []
    }));
  }
  
  return product;
}

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
  getProductImages,
  updateProductImage,
  deleteProductImage,
  
  // Related product operations
  addRelatedProduct,
  removeRelatedProduct,
  
  // File operations
  generateDownloadLink,
  downloadFile
};