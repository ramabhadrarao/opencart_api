// controllers/manufacturer.controller.js
import Manufacturer from '../models/manufacturer.model.js';
import Product from '../models/product.model.js';

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
};// controllers/manufacturer.controller.js
import Manufacturer from '../models/manufacturer.model.js';
import Product from '../models/product.model.js';

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