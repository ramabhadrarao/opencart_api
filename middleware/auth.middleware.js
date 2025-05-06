// middleware/auth.middleware.js
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
