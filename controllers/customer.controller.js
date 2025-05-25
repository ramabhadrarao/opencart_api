// Complete Customer Controller with CRUD for all components
import Customer from '../models/customer.model.js';
import Address from '../models/address.model.js';
import { hashOpenCartPassword } from '../utils/passwordUtils.js';
import { generateTokens } from '../utils/jwtUtils.js';
import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail, sendWelcomeEmail } from '../utils/emailService.js';
import auditLogService from '../utils/auditLogService.js';
import crypto from 'crypto';
import { getNextCustomerId } from '../utils/idGenerator.js';
// MAIN CUSTOMER OPERATIONS

/**
 * Get all customers (admin only)
 */
export const getAllCustomers = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Build query with filters
    const filters = {};
    
    if (req.query.status) {
      filters.status = req.query.status === 'true';
    }
    
    if (req.query.search) {
      filters.$or = [
        { firstname: { $regex: req.query.search, $options: 'i' } },
        { lastname: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { telephone: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    if (req.query.group) {
      filters.customer_group_id = parseInt(req.query.group);
    }
    
    if (req.query.date_from || req.query.date_to) {
      filters.date_added = {};
      
      if (req.query.date_from) {
        filters.date_added.$gte = new Date(req.query.date_from);
      }
      
      if (req.query.date_to) {
        filters.date_added.$lte = new Date(req.query.date_to);
      }
    }
    
    // Get customers with pagination
    const customers = await Customer.find(filters)
      .select('-password -salt -reset_token -reset_token_expiry')
      .sort({ date_added: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Customer.countDocuments(filters);
    
    res.json({
      customers: customers.map(customer => ({
        customer_id: customer.customer_id,
        firstname: customer.firstname,
        lastname: customer.lastname,
        email: customer.email,
        telephone: customer.telephone,
        status: customer.status,
        date_added: customer.date_added
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching customers', error: err.message });
  }
};

/**
 * Get a customer by ID (admin only)
 */
export const getCustomerById = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const customerId = parseInt(req.params.id);
    
    const customer = await Customer.findOne({ customer_id: customerId })
      .select('-password -salt');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching customer', error: err.message });
  }
};

/**
 * Login a customer
 */
export const loginCustomer = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    
    const customer = await Customer.findOne({ email });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if account is disabled
    if (!customer.status) {
      return res.status(403).json({ message: 'Account is disabled' });
    }
    
    // Verify password
    const hashedInput = hashOpenCartPassword(password, customer.salt);
    if (hashedInput !== customer.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate tokens
    const payload = {
      id: customer.customer_id,
      email: customer.email,
      name: `${customer.firstname} ${customer.lastname}`
    };
    
    const { accessToken, refreshToken } = generateTokens(payload);
    
    // Update login stats
    customer.last_login = new Date();
    customer.last_ip = req.ip;
    customer.total_logins = (customer.total_logins || 0) + 1;
    await customer.save();
    
    // Set response body for activityTracker middleware
    const responseData = {
      message: 'Login successful',
      accessToken,
      refreshToken,
      customer: payload
    };
    
    res._body = JSON.stringify(responseData);
    
    res.json(responseData);
  } catch (err) {
    res.status(500).json({ message: 'Error during login', error: err.message });
  }
};

/**
 * Register a new customer
 */
export const registerCustomer = async (req, res) => {
  try {
    const { 
      firstname, 
      lastname, 
      email, 
      telephone, 
      password,
      newsletter = false,
      agree = false
    } = req.body;
    
    // Validate required fields
    if (!firstname || !lastname || !email || !telephone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format' });
    }
    
    // Check if email is already registered
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    
    // Generate random salt
    const salt = crypto.randomBytes(9).toString('base64');
    
    // Hash password using OpenCart's method
    const hashedPassword = hashOpenCartPassword(password, salt);
    
    // ✅ USE ID GENERATOR FOR CUSTOMER
    const newCustomerId = await getNextCustomerId();
    
    // Create new customer
    const newCustomer = new Customer({
      customer_id: newCustomerId,
      firstname,
      lastname,
      email,
      telephone,
      salt,
      password: hashedPassword,
      newsletter,
      status: true,
      date_added: new Date(),
      ip: req.ip
    });
    
    await newCustomer.save();
    
    // Generate tokens for automatic login
    const payload = {
      id: newCustomerId,
      email,
      name: `${firstname} ${lastname}`
    };
    
    const { accessToken, refreshToken } = generateTokens(payload);
    
    // Send welcome email
    try {
      await sendWelcomeEmail({
        email,
        firstname,
        lastname
      });
    } catch (emailErr) {
      console.error('Error sending welcome email:', emailErr.message);
      // Continue with registration even if email fails
    }
    
    // Log this action
    auditLogService.logCreate(req, 'customer', newCustomer.toObject());
    
    res.status(201).json({
      message: 'Registration successful',
      accessToken,
      refreshToken,
      customer: {
        id: newCustomerId,
        name: `${firstname} ${lastname}`,
        email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error registering customer', error: err.message });
  }
};

/**
 * Get customer profile (for the customer themselves)
 */
export const getProfile = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    const customer = await Customer.findOne({ customer_id: customerId })
      .select('-password -salt -reset_token -reset_token_expiry');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({
      customer_id: customer.customer_id,
      firstname: customer.firstname,
      lastname: customer.lastname,
      email: customer.email,
      telephone: customer.telephone,
      newsletter: customer.newsletter,
      addresses: customer.addresses || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
};

/**
 * Update customer profile
 */
export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { firstname, lastname, email, telephone, newsletter } = req.body;
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Keep original for audit log
    const originalCustomer = customer.toObject();
    
    // Check if new email is already taken by another customer
    if (email && email !== customer.email) {
      const existingEmail = await Customer.findOne({ 
        email, 
        customer_id: { $ne: customerId } 
      });
      
      if (existingEmail) {
        return res.status(409).json({ message: 'Email is already in use' });
      }
    }
    
    // Update fields
    if (firstname) customer.firstname = firstname;
    if (lastname) customer.lastname = lastname;
    if (email) customer.email = email;
    if (telephone) customer.telephone = telephone;
    if (newsletter !== undefined) customer.newsletter = newsletter;
    
    await customer.save();
    
    // Log this action
    auditLogService.logUpdate(req, 'customer', originalCustomer, customer.toObject());
    
    res.json({
      message: 'Profile updated successfully',
      customer: {
        id: customer.customer_id,
        name: `${customer.firstname} ${customer.lastname}`,
        email: customer.email,
        telephone: customer.telephone
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};

/**
 * Change customer password
 */
export const changePassword = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Verify current password
    const hashedCurrent = hashOpenCartPassword(current_password, customer.salt);
    if (hashedCurrent !== customer.password) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    const hashedNew = hashOpenCartPassword(new_password, customer.salt);
    customer.password = hashedNew;
    
    await customer.save();
    
    // Log this action (without exposing password details)
    auditLogService.logCustomAction(
      req, 
      'change_password',
      'customer',
      customer.customer_id,
      { customer_id: customer.customer_id },
      'Customer changed their password'
    );
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password', error: err.message });
  }
};

/**
 * Request password reset
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const customer = await Customer.findOne({ email });
    
    if (!customer) {
      // For security, don't reveal if email exists or not
      return res.json({ 
        message: 'Password reset instructions sent to your email if it exists in our system'
      });
    }
    
    // Generate reset token
    const resetToken = uuidv4();
    customer.reset_token = resetToken;
    customer.reset_token_expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min expiry
    
    await customer.save();
    
    // Construct reset URL (frontend URL)
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password`;
    
    // Send email
    try {
      await sendPasswordResetEmail(
        customer.email,
        resetToken,
        resetUrl
      );
    } catch (emailErr) {
      console.error('Error sending password reset email:', emailErr.message);
      // Continue even if email fails
    }
    
    res.json({ 
      message: 'Password reset instructions sent to your email'
    });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error processing password reset request', 
      error: err.message 
    });
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, token, new_password } = req.body;
    
    if (!email || !token || !new_password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const customer = await Customer.findOne({ 
      email,
      reset_token: token,
      reset_token_expiry: { $gt: new Date() }
    });
    
    if (!customer) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }
    
    // Update password
    const hashedNew = hashOpenCartPassword(new_password, customer.salt);
    customer.password = hashedNew;
    customer.reset_token = undefined;
    customer.reset_token_expiry = undefined;
    
    await customer.save();
    
    // Log this action
    auditLogService.logCustomAction(
      req, 
      'reset_password',
      'customer',
      customer.customer_id,
      { customer_id: customer.customer_id },
      'Customer reset their password'
    );
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ 
      message: 'Error updating password', 
      error: err.message 
    });
  }
};

/**
 * Delete customer (admin only)
 */
export const deleteCustomer = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const customerId = parseInt(req.params.id);
    
    // Get customer first for audit log
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Delete the customer
    await Customer.deleteOne({ customer_id: customerId });
    
    // Also remove addresses for this customer
    await Address.deleteMany({ customer_id: customerId });
    
    // Log this action
    auditLogService.logDelete(req, 'customer', customer.toObject());
    
    res.json({
      message: 'Customer deleted successfully',
      customer_id: customerId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting customer', error: err.message });
  }
};

// ADDRESS OPERATIONS

/**
 * Get customer addresses
 */
export const getAddresses = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    const customer = await Customer.findOne({ customer_id: customerId })
      .select('addresses');
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    res.json({
      addresses: customer.addresses || []
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching addresses', error: err.message });
  }
};

/**
 * Add address for customer
 */
export const addAddress = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressData = req.body;
    
    // Validate required fields
    if (!addressData.firstname || !addressData.lastname || !addressData.address_1 || 
        !addressData.city || !addressData.country_id) {
      return res.status(400).json({ message: 'Missing required address fields' });
    }
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get next address_id
    let maxAddressId = 0;
    if (customer.addresses && customer.addresses.length > 0) {
      maxAddressId = Math.max(...customer.addresses.map(addr => addr.address_id || 0));
    }
    const newAddressId = maxAddressId + 1;
    
    // Add address
    const newAddress = {
      address_id: newAddressId,
      ...addressData
    };
    
    if (!customer.addresses) {
      customer.addresses = [];
    }
    
    customer.addresses.push(newAddress);
    
    // If this is the first address, set it as default
    if (customer.addresses.length === 1) {
      customer.address_id = newAddressId;
    }
    
    await customer.save();
    
    res.status(201).json({
      message: 'Address added successfully',
      address_id: newAddressId,
      address: newAddress
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding address', error: err.message });
  }
};

/**
 * Update customer address
 */
export const updateAddress = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = parseInt(req.params.addressId);
    const addressData = req.body;
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Find address index
    const addrIndex = customer.addresses.findIndex(a => a.address_id === addressId);
    
    if (addrIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // Update address
    customer.addresses[addrIndex] = {
      ...customer.addresses[addrIndex],
      ...addressData,
      address_id: addressId
    };
    
    await customer.save();
    
    res.json({
      message: 'Address updated successfully',
      address_id: addressId,
      address: customer.addresses[addrIndex]
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating address', error: err.message });
  }
};

/**
 * Delete customer address
 */
export const deleteAddress = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = parseInt(req.params.addressId);
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if address exists
    const addrIndex = customer.addresses.findIndex(a => a.address_id === addressId);
    
    if (addrIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // Remove address
    customer.addresses.splice(addrIndex, 1);
    
    // If deleted address was the default address, update default
    if (customer.address_id === addressId) {
      customer.address_id = customer.addresses.length > 0 ? 
        customer.addresses[0].address_id : 0;
    }
    
    await customer.save();
    
    res.json({
      message: 'Address deleted successfully',
      address_id: addressId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting address', error: err.message });
  }
};

/**
 * Set default address
 */
export const setDefaultAddress = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const addressId = parseInt(req.params.addressId);
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if address exists
    const addrExists = customer.addresses.some(a => a.address_id === addressId);
    
    if (!addrExists) {
      return res.status(404).json({ message: 'Address not found' });
    }
    
    // Set as default
    customer.address_id = addressId;
    
    await customer.save();
    
    res.json({
      message: 'Default address updated successfully',
      default_address_id: addressId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error setting default address', error: err.message });
  }
};

// CUSTOMER MANAGEMENT (ADMIN ONLY)

/**
 * Create a customer (admin only)
 */
// Create a customer (admin only) - ✅ UPDATED WITH ID GENERATOR
export const createCustomer = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { 
      firstname, 
      lastname, 
      email, 
      telephone, 
      password,
      customer_group_id = 1,
      newsletter = false,
      status = true
    } = req.body;
    
    // Validate required fields
    if (!firstname || !lastname || !email || !telephone || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Check if email is already registered
    const existingCustomer = await Customer.findOne({ email });
    if (existingCustomer) {
      return res.status(409).json({ message: 'Email is already registered' });
    }
    
    // Generate random salt
    const salt = crypto.randomBytes(9).toString('base64');
    
    // Hash password using OpenCart's method
    const hashedPassword = hashOpenCartPassword(password, salt);
    
    // ✅ USE ID GENERATOR FOR CUSTOMER
    const newCustomerId = await getNextCustomerId();
    
    // Create new customer
    const newCustomer = new Customer({
      customer_id: newCustomerId,
      customer_group_id,
      firstname,
      lastname,
      email,
      telephone,
      salt,
      password: hashedPassword,
      newsletter,
      status,
      date_added: new Date()
    });
    
    await newCustomer.save();
    
    // Log this action
    auditLogService.logCreate(req, 'customer', newCustomer.toObject());
    
    res.status(201).json({
      message: 'Customer created successfully',
      customer_id: newCustomerId,
      customer: {
        customer_id: newCustomerId,
        firstname,
        lastname,
        email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating customer', error: err.message });
  }
};

/**
 * Update a customer (admin only)
 */
export const updateCustomer = async (req, res) => {
  try {
    // Must have admin rights
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const customerId = parseInt(req.params.id);
    const updateData = req.body;
    
    const customer = await Customer.findOne({ customer_id: customerId });
    
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Keep original for audit log
    const originalCustomer = customer.toObject();
    
    // Check if new email is already taken by another customer
    if (updateData.email && updateData.email !== customer.email) {
      const existingEmail = await Customer.findOne({ 
        email: updateData.email, 
        customer_id: { $ne: customerId } 
      });
      
      if (existingEmail) {
        return res.status(409).json({ message: 'Email is already in use' });
      }
    }
    
    // Update regular fields (except password and address_id)
    const allowedFields = [
      'firstname', 'lastname', 'email', 'telephone', 'fax',
      'customer_group_id', 'newsletter', 'status', 'safe'
    ];
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        customer[field] = updateData[field];
      }
    });
    
    // If password is provided, update it
    if (updateData.password) {
      const hashedPassword = hashOpenCartPassword(updateData.password, customer.salt);
      customer.password = hashedPassword;
    }
    
    await customer.save();
    
    // Log this action
    auditLogService.logUpdate(req, 'customer', originalCustomer, customer.toObject());
    
    res.json({
      message: 'Customer updated successfully',
      customer_id: customerId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating customer', error: err.message });
  }
};

// Export all functions
export default {
  // Main customer operations
  getAllCustomers,
  getCustomerById,
  loginCustomer,
  registerCustomer,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  deleteCustomer,
  
  // Address operations
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  
  // Admin operations
  createCustomer,
  updateCustomer
};