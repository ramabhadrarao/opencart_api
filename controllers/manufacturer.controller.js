// controllers/manufacturer.controller.js
import Manufacturer from '../models/manufacturer.model.js';
import Product from '../models/product.model.js';
import { getNextManufacturerId } from '../utils/idGenerator.js';
// Get all manufacturers
export const getAllManufacturers = async (req, res) => {
  try {
    const manufacturers = await Manufacturer.find().sort({ name: 1 });
    res.json(manufacturers);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching manufacturers', error: err.message });
  }
};

// Get manufacturer by ID with products
export const getManufacturerById = async (req, res) => {
  try {
    const manufacturerId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get the manufacturer
    const manufacturer = await Manufacturer.findOne({ manufacturer_id: manufacturerId });
    
    if (!manufacturer) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }
    
    // Get products for this manufacturer
    const products = await Product.find({ 
      manufacturer_id: manufacturerId,
      status: true
    })
    .sort({ sort_order: 1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Product.countDocuments({ 
      manufacturer_id: manufacturerId,
      status: true
    });
    
    // Format products
    const formattedProducts = products.map(product => {
      const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || '',
        model: product.model,
        price: product.price,
        image: product.image,
        quantity: product.quantity
      };
    });
    
    res.json({
      manufacturer_id: manufacturer.manufacturer_id,
      name: manufacturer.name,
      image: manufacturer.image,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching manufacturer', error: err.message });
  }
};

// Create manufacturer (Admin only)
export const createManufacturer = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, image, sort_order = 0 } = req.body;
    
    if (!name) {
      return res.status(400).json({ message: 'Manufacturer name is required' });
    }
    
    // Check if name already exists
    const existingManufacturer = await Manufacturer.findOne({ name });
    if (existingManufacturer) {
      return res.status(409).json({ message: 'Manufacturer name already exists' });
    }
    
    // ✅ USE ID GENERATOR
    const manufacturerId = await getNextManufacturerId();
    
    const manufacturer = new Manufacturer({
      manufacturer_id: manufacturerId,
      name,
      image: image || '',
      sort_order
    });
    
    await manufacturer.save();
    
    auditLogService.logCreate(req, 'manufacturer', manufacturer.toObject());
    
    res.status(201).json({
      message: 'Manufacturer created successfully',
      manufacturer_id: manufacturerId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating manufacturer', error: err.message });
  }
};

// Update manufacturer
export const updateManufacturer = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const manufacturerId = parseInt(req.params.id);
    const updateData = req.body;
    
    const manufacturer = await Manufacturer.findOne({ manufacturer_id: manufacturerId });
    if (!manufacturer) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }
    
    const originalManufacturer = manufacturer.toObject();
    
    // Check if new name already exists
    if (updateData.name && updateData.name !== manufacturer.name) {
      const existingManufacturer = await Manufacturer.findOne({ 
        name: updateData.name,
        manufacturer_id: { $ne: manufacturerId }
      });
      
      if (existingManufacturer) {
        return res.status(409).json({ message: 'Manufacturer name already exists' });
      }
    }
    
    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'manufacturer_id') {
        manufacturer[key] = updateData[key];
      }
    });
    
    await manufacturer.save();
    
    auditLogService.logUpdate(req, 'manufacturer', originalManufacturer, manufacturer.toObject());
    
    res.json({
      message: 'Manufacturer updated successfully',
      manufacturer_id: manufacturerId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating manufacturer', error: err.message });
  }
};

// Delete manufacturer
export const deleteManufacturer = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const manufacturerId = parseInt(req.params.id);
    
    // Check if manufacturer has products
    const productCount = await Product.countDocuments({ manufacturer_id: manufacturerId });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete manufacturer with ${productCount} products` 
      });
    }
    
    const manufacturer = await Manufacturer.findOne({ manufacturer_id: manufacturerId });
    if (!manufacturer) {
      return res.status(404).json({ message: 'Manufacturer not found' });
    }
    
    await Manufacturer.deleteOne({ manufacturer_id: manufacturerId });
    
    auditLogService.logDelete(req, 'manufacturer', manufacturer.toObject());
    
    res.json({
      message: 'Manufacturer deleted successfully',
      manufacturer_id: manufacturerId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting manufacturer', error: err.message });
  }
};

export default {
  getAllManufacturers,
  getManufacturerById,
  createManufacturer,
  updateManufacturer,
  deleteManufacturer
};