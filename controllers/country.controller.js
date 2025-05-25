// controllers/country.controller.js
import Country from '../models/country.model.js';
import { getNextCountryId } from '../utils/idGenerator.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';
import auditLogService from '../utils/auditLogService.js';

// Get all countries
export const getAllCountries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Build filters
    const filters = {};
    
    if (req.query.status !== undefined) {
      filters.status = req.query.status === 'true';
    }
    
    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { iso_code_2: { $regex: req.query.search, $options: 'i' } },
        { iso_code_3: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const countries = await Country.find(filters)
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Country.countDocuments(filters);
    
    res.json({
      countries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching countries', error: err.message });
  }
};

// Get country by ID
export const getCountryById = async (req, res) => {
  try {
    const countryId = parseInt(req.params.id);
    const country = await Country.findOne({ country_id: countryId });
    
    if (!country) {
      return res.status(404).json({ message: 'Country not found' });
    }
    
    res.json(country);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching country', error: err.message });
  }
};

// Create country (Admin only)
export const createCountry = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { name, iso_code_2, iso_code_3, address_format, postcode_required, status } = req.body;
    
    if (!name || !iso_code_2) {
      return res.status(400).json({ message: 'Name and ISO code 2 are required' });
    }
    
    const countryId = await getNextCountryId();
    
    const country = new Country({
      country_id: countryId,
      name,
      iso_code_2,
      iso_code_3,
      address_format,
      postcode_required: postcode_required || false,
      status: status !== undefined ? status : true
    });
    
    await country.save();
    
    // Log action
    auditLogService.logCreate(req, 'country', country.toObject());
    
    res.status(201).json({
      message: 'Country created successfully',
      country_id: countryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating country', error: err.message });
  }
};

// Update country (Admin only)
export const updateCountry = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const countryId = parseInt(req.params.id);
    const updateData = req.body;
    
    const country = await Country.findOne({ country_id: countryId });
    if (!country) {
      return res.status(404).json({ message: 'Country not found' });
    }
    
    const originalCountry = country.toObject();
    
    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'country_id') {
        country[key] = updateData[key];
      }
    });
    
    await country.save();
    
    // Log action
    auditLogService.logUpdate(req, 'country', originalCountry, country.toObject());
    
    res.json({
      message: 'Country updated successfully',
      country_id: countryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating country', error: err.message });
  }
};

// Delete country (Admin only)
export const deleteCountry = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const countryId = parseInt(req.params.id);
    
    const country = await Country.findOne({ country_id: countryId });
    if (!country) {
      return res.status(404).json({ message: 'Country not found' });
    }
    
    await Country.deleteOne({ country_id: countryId });
    
    // Log action
    auditLogService.logDelete(req, 'country', country.toObject());
    
    res.json({
      message: 'Country deleted successfully',
      country_id: countryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting country', error: err.message });
  }
};

export default {
  getAllCountries,
  getCountryById,
  createCountry,
  updateCountry,
  deleteCountry
};