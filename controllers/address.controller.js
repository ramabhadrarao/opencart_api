// controllers/address.controller.js (Standalone Address Management)
import Address from '../models/address.model.js';
import Customer from '../models/customer.model.js';
import { getNextAddressId } from '../utils/idGenerator.js';
import auditLogService from '../utils/auditLogService.js';

// Get all addresses (Admin only)
export const getAllAddresses = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    const filters = {};
    
    if (req.query.customer_id) {
      filters.customer_id = parseInt(req.query.customer_id);
    }
    
    if (req.query.country_id) {
      filters.country_id = parseInt(req.query.country_id);
    }
    
    if (req.query.search) {
      filters.$or = [
        { firstname: { $regex: req.query.search, $options: 'i' } },
        { lastname: { $regex: req.query.search, $options: 'i' } },
        { city: { $regex: req.query.search, $options: 'i' } },
        { address_1: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const addresses = await Address.find(filters)
      .sort({ customer_id: 1, address_id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const total = await Address.countDocuments(filters);
    
    // Enrich with customer info
    const enrichedAddresses = await Promise.all(addresses.map(async (address) => {
      const customer = await Customer.findOne({ customer_id: address.customer_id })
        .select('firstname lastname email')
        .lean();
      
      return {
        ...address,
        customer_info: customer ? {
          name: `${customer.firstname} ${customer.lastname}`,
          email: customer.email
        } : null
      };
    }));
    
    res.json({
      addresses: enrichedAddresses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching addresses', error: err.message });
  }
};

// Get address by ID
export const getAddressById = async (req, res) => {
  try {
    const addressId = parseInt(req.params.id);
    
    // Check permissions
    let filters = { address_id: addressId };
    
    if (req.customer && !req.admin) {
      // Customer can only access their own addresses
      filters.customer_id = req.customer.id;
    }
    
    const address = await Address.findOne(filters).lean();
    
    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    res.json(address);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching address', error: err.message });
  }
};

// Create standalone address (Admin only)
export const createAddress = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { customer_id, firstname, lastname, company, address_1, address_2, city, postcode, country_id, zone_id } = req.body;
    
    if (!customer_id || !firstname || !lastname || !address_1 || !city || !country_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Verify customer exists
    const customer = await Customer.findOne({ customer_id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    const addressId = await getNextAddressId();
    
    const address = new Address({
      address_id: addressId,
      customer_id,
      firstname,
      lastname,
      company: company || '',
      address_1,
      address_2: address_2 || '',
      city,
      postcode: postcode || '',
      country_id,
      zone_id: zone_id || 0,
      custom_field: req.body.custom_field || ''
    });
    
    await address.save();
    
    auditLogService.logCreate(req, 'address', address.toObject());
    
    res.status(201).json({
      message: 'Address created successfully',
      address_id: addressId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating address', error: err.message });
  }
};

export const addressController = {
  getAllAddresses,
  getAddressById,
  createAddress
};
