// controllers/admin.controller.js
import Admin from '../models/admin.model.js';
import { hashOpenCartPassword } from '../utils/passwordUtils.js';
import { generateTokens } from '../utils/jwtUtils.js';

// LOGIN
export const loginAdmin = async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const admin = await Admin.findOne({ username });

    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.status) return res.status(403).json({ message: 'Account is disabled' });

    const hashedInput = hashOpenCartPassword(password, admin.salt);
    if (hashedInput !== admin.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = {
      id: admin.user_id,
      username: admin.username,
      name: `${admin.firstname} ${admin.lastname}`,
      isAdmin: true
    };

    const { accessToken, refreshToken } = generateTokens(payload);

    return res.json({
      message: 'Admin login successful',
      accessToken,
      refreshToken,
      admin: payload
    });
  } catch (err) {
    return res.status(500).json({ message: 'Error during login', error: err.message });
  }
};

// GET PROFILE
export const getProfile = async (req, res) => {
  try {
    const admin = await Admin.findOne({ user_id: req.admin.id });
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    res.json({
      id: admin.user_id,
      username: admin.username,
      name: `${admin.firstname} ${admin.lastname}`,
      email: admin.email,
      user_group_id: admin.user_group_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
};

// UPDATE ADMIN
export const updateAdmin = async (req, res) => {
  try {
    const adminId = parseInt(req.params.id);
    const { firstname, lastname, email, username } = req.body;
    
    // Only allow admins to update themselves or superadmins to update others
    if (req.admin.id !== adminId && req.admin.user_group_id !== 1) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const admin = await Admin.findOne({ user_id: adminId });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Update fields
    if (firstname) admin.firstname = firstname;
    if (lastname) admin.lastname = lastname;
    if (email) admin.email = email;
    if (username && req.admin.user_group_id === 1) admin.username = username;
    
    await admin.save();
    
    res.json({
      message: 'Admin updated successfully',
      admin: {
        id: admin.user_id,
        username: admin.username,
        name: `${admin.firstname} ${admin.lastname}`,
        email: admin.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating admin', error: err.message });
  }
};

// CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const adminId = req.admin.id;
    const { current_password, new_password } = req.body;
    
    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const admin = await Admin.findOne({ user_id: adminId });
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Verify current password
    const hashedCurrent = hashOpenCartPassword(current_password, admin.salt);
    if (hashedCurrent !== admin.password) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }
    
    // Update password
    const hashedNew = hashOpenCartPassword(new_password, admin.salt);
    admin.password = hashedNew;
    
    await admin.save();
    
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error changing password', error: err.message });
  }
};

// GET ALL ADMINS (superadmin only)
export const getAllAdmins = async (req, res) => {
  try {
    // Check if requester is superadmin
    if (req.admin.user_group_id !== 1) {
      return res.status(403).json({ message: 'Permission denied' });
    }
    
    const admins = await Admin.find().select('-password -salt');
    
    res.json({
      count: admins.length,
      admins: admins.map(admin => ({
        id: admin.user_id,
        username: admin.username,
        name: `${admin.firstname} ${admin.lastname}`,
        email: admin.email,
        user_group_id: admin.user_group_id,
        status: admin.status,
        date_added: admin.date_added
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching admins', error: err.message });
  }
};