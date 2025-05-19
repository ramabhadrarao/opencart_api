// Updated controllers/customer.controller.js
import Customer from '../models/customer.model.js';
import { hashOpenCartPassword } from '../utils/passwordUtils.js';
import { generateTokens } from '../utils/jwtUtils.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { 
  sendPasswordResetEmail, 
  sendWelcomeEmail 
} from '../utils/emailService.js';

dotenv.config();

// LOGIN
export const loginCustomer = async (req, res) => {
  const { email, password } = req.body;
  const user = await Customer.findOne({ email });

  if (!user) return res.status(404).json({ message: 'Customer not found' });

  const hashedInput = hashOpenCartPassword(password, user.salt);
  if (hashedInput !== user.password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const payload = {
    id: user.customer_id,
    email: user.email,
    name: `${user.firstname} ${user.lastname}`
  };

  const { accessToken, refreshToken } = generateTokens(payload);

  const responseData = {
    message: 'Login successful',
    accessToken,
    refreshToken,
    customer: payload
  };
  
  // Set response body for activityTracker middleware
  res._body = JSON.stringify(responseData);

  return res.json(responseData);
};

// PROTECTED PROFILE (test)
export const getProfile = async (req, res) => {
  const customer = await Customer.findOne({ customer_id: req.customer.id });
  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  res.json({
    id: customer.customer_id,
    name: `${customer.firstname} ${customer.lastname}`,
    email: customer.email,
    telephone: customer.telephone
  });
};

// FORGOT PASSWORD - Updated with email
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  
  try {
    const customer = await Customer.findOne({ email });

    if (!customer) return res.status(404).json({ message: 'Customer not found' });

    const resetToken = uuidv4();
    customer.reset_token = resetToken;
    customer.reset_token_expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min expiry
    await customer.save();

    // Construct reset URL (frontend URL)
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password`;
    
    // Send email
    await sendPasswordResetEmail(
      customer.email,
      resetToken,
      resetUrl
    );

    return res.json({ 
      message: 'Password reset instructions sent to your email',
      success: true
    });
  } catch (err) {
    console.error('Error in forgot password:', err);
    return res.status(500).json({ 
      message: 'Error processing password reset request', 
      error: err.message 
    });
  }
};

// RESET PASSWORD - Updated
export const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  try {
    const customer = await Customer.findOne({ 
      email,
      reset_token: token,
      reset_token_expiry: { $gt: new Date() }
    });

    if (!customer) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const newHash = hashOpenCartPassword(newPassword, customer.salt);
    customer.password = newHash;
    customer.reset_token = undefined;
    customer.reset_token_expiry = undefined;

    await customer.save();

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Error in reset password:', err);
    return res.status(500).json({ 
      message: 'Error updating password', 
      error: err.message 
    });
  }
};

// Register a new customer - Updated with welcome email
export const registerCustomer = async (req, res) => {
  try {
    const { 
      firstname, 
      lastname, 
      email, 
      telephone, 
      password,
      newsletter = 0,
      agree = 0
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
    
    // Get next customer_id
    const lastCustomer = await Customer.findOne().sort({ customer_id: -1 });
    const newCustomerId = lastCustomer ? lastCustomer.customer_id + 1 : 1;
    
    // Create new customer
    const newCustomer = new Customer({
      customer_id: newCustomerId,
      firstname,
      lastname,
      email,
      telephone,
      salt,
      password: hashedPassword,
      newsletter: newsletter === 1,
      status: true, // Auto-approve for now
      date_added: new Date()
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
      console.log('Welcome email sent to:', email);
    } catch (emailErr) {
      console.error('Error sending welcome email:', emailErr.message);
      // Continue with registration even if email fails
    }
    
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

// Update customer profile
export const updateProfile = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { firstname, lastname, email, telephone } = req.body;
    
    // Find customer
    const customer = await Customer.findOne({ customer_id: customerId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if new email is already taken by another customer
    if (email && email !== customer.email) {
      const existingEmail = await Customer.findOne({ email, customer_id: { $ne: customerId } });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email is already in use' });
      }
    }
    
    // Update fields
    if (firstname) customer.firstname = firstname;
    if (lastname) customer.lastname = lastname;
    if (email) customer.email = email;
    if (telephone) customer.telephone = telephone;
    
    await customer.save();
    
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

// Change password
export const changePassword = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Find customer
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
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password', error: err.message });
  }
};

// Get customer addresses
export const getAddresses = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // This assumes we've migrated the address table to MongoDB
    // If not, we'd need to connect to MySQL for this data
    const addresses = await Address.find({ customer_id: customerId });
    
    res.json(addresses);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching addresses', error: err.message });
  }
};

// Add new address
export const addAddress = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { 
      firstname, 
      lastname, 
      company, 
      address_1, 
      address_2, 
      city, 
      postcode, 
      country_id, 
      zone_id 
    } = req.body;
    
    // Validate required fields
    if (!firstname || !lastname || !address_1 || !city || !country_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Get next address_id
    const lastAddress = await Address.findOne().sort({ address_id: -1 });
    const newAddressId = lastAddress ? lastAddress.address_id + 1 : 1;
    
    // Create new address
    const newAddress = new Address({
      address_id: newAddressId,
      customer_id: customerId,
      firstname,
      lastname,
      company,
      address_1,
      address_2,
      city,
      postcode,
      country_id,
      zone_id,
      custom_field: ''
    });
    
    await newAddress.save();
    
    res.status(201).json({
      message: 'Address added successfully',
      address: newAddress
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding address', error: err.message });
  }
};

// Refresh token
export const refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    
    if (!refresh_token) {
      return res.status(400).json({ message: 'Refresh token is required' });
    }
    
    // Verify refresh token
    const decoded = verifyRefreshToken(refresh_token);
    
    // Generate new tokens
    const payload = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name
    };
    
    const { accessToken, refreshToken } = generateTokens(payload);
    
    res.json({
      accessToken,
      refreshToken,
      customer: payload
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired refresh token' });
  }
};