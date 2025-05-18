// middleware/auth.middleware.js (updated)
import { verifyAccessToken } from '../utils/jwtUtils.js';

export const authenticateCustomer = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    req.customer = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authenticateAdmin = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    // Check if token is for an admin
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Middleware that allows either customer or admin access
export const authenticateUser = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    if (decoded.isAdmin) {
      req.admin = decoded;
      req.isAdmin = true;
    } else {
      req.customer = decoded;
      req.isAdmin = false;
    }
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};