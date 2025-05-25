// ================================================================
// controllers/zone.controller.js
import Zone from '../models/zone.model.js';
import { getNextZoneId } from '../utils/idGenerator.js';
import auditLogService from '../utils/auditLogService.js';

// Get all zones
export const getAllZones = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    const filters = {};
    
    if (req.query.country_id) {
      filters.country_id = parseInt(req.query.country_id);
    }
    
    if (req.query.status !== undefined) {
      filters.status = req.query.status === 'true';
    }
    
    if (req.query.search) {
      filters.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { code: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const zones = await Zone.find(filters)
      .sort({ country_id: 1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Zone.countDocuments(filters);
    
    res.json({
      zones,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching zones', error: err.message });
  }
};

// Get zones by country
export const getZonesByCountry = async (req, res) => {
  try {
    const countryId = parseInt(req.params.country_id);
    
    const zones = await Zone.find({ 
      country_id: countryId,
      status: true
    }).sort({ name: 1 }).lean();
    
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching zones', error: err.message });
  }
};

// Create zone (Admin only)
export const createZone = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { country_id, name, code, status } = req.body;
    
    if (!country_id || !name || !code) {
      return res.status(400).json({ message: 'Country ID, name, and code are required' });
    }
    
    const zoneId = await getNextZoneId();
    
    const zone = new Zone({
      zone_id: zoneId,
      country_id,
      name,
      code,
      status: status !== undefined ? status : true
    });
    
    await zone.save();
    
    auditLogService.logCreate(req, 'zone', zone.toObject());
    
    res.status(201).json({
      message: 'Zone created successfully',
      zone_id: zoneId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating zone', error: err.message });
  }
};

export const zoneController = {
  getAllZones,
  getZonesByCountry,
  createZone
};
