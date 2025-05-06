// controllers/customer.controller.js
import Customer from '../models/customer.model.js';
import { hashOpenCartPassword } from '../utils/passwordUtils.js';
import { generateTokens } from '../utils/jwtUtils.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

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

  return res.json({
    message: 'Login successful',
    accessToken,
    refreshToken,
    customer: payload
  });
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

// FORGOT PASSWORD - Placeholder
export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  const customer = await Customer.findOne({ email });

  if (!customer) return res.status(404).json({ message: 'Customer not found' });

  const resetToken = uuidv4();
  customer.reset_token = resetToken;
  customer.reset_token_expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 min expiry
  await customer.save();

  // TODO: Send email with token
  return res.json({ message: 'Reset token generated. Email functionality pending.', token: resetToken });
};

// RESET PASSWORD - Placeholder
export const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  const customer = await Customer.findOne({ email });

  if (!customer || customer.reset_token !== token || new Date() > customer.reset_token_expiry) {
    return res.status(400).json({ message: 'Invalid or expired token' });
  }

  const newHash = hashOpenCartPassword(newPassword, customer.salt);
  customer.password = newHash;
  customer.reset_token = undefined;
  customer.reset_token_expiry = undefined;

  await customer.save();

  return res.json({ message: 'Password updated successfully' });
};
