// middleware/auth.middleware.js
import { verifyAccessToken } from '../utils/jwtUtils.js';
import OnlineUser from '../models/onlineUser.model.js';

export const authenticateCustomer = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    req.customer = decoded;
    
    // Ensure the user's session is updated with the correct user type
    try {
      const sessionId = req.cookies?.session_id;
      if (sessionId) {
        console.log(`Updating session ${sessionId} for customer ${decoded.id}`);
        
        const result = await OnlineUser.updateOne(
          { session_id: sessionId },
          { 
            $set: { 
              user_id: decoded.id,
              user_type: 'customer',  // Explicitly set as customer
              username: decoded.name,
              email: decoded.email,
              last_activity: new Date()
            } 
          }
        );
        
        console.log(`Customer session update result: modified=${result.modifiedCount}`);
      } else {
        console.log('No session cookie found in authenticated request');
      }
    } catch (err) {
      console.error('Error updating session in auth middleware:', err);
      // Continue even if update fails
    }
    
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

export const authenticateAdmin = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    // Check if token is for an admin
    if (!decoded.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    req.admin = decoded;
    
    // Ensure the user's session is updated with the correct user type
    try {
      const sessionId = req.cookies?.session_id;
      if (sessionId) {
        await OnlineUser.updateOne(
          { session_id: sessionId },
          { 
            $set: { 
              user_id: decoded.id,
              user_type: 'admin',
              username: decoded.username,
              email: decoded.email,
              last_activity: new Date()
            } 
          }
        );
        console.log('Updated admin session data in auth middleware:', {
          session_id: sessionId,
          user_id: decoded.id,
          user_type: 'admin'
        });
      }
    } catch (err) {
      console.error('Error updating session in auth middleware:', err);
      // Continue even if update fails
    }
    
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};

// Middleware that allows either customer or admin access
export const authenticateUser = async (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token missing' });

  try {
    const decoded = verifyAccessToken(token);
    
    // Update session with the correct user type
    try {
      const sessionId = req.cookies?.session_id;
      if (sessionId) {
        if (decoded.isAdmin) {
          req.admin = decoded;
          req.isAdmin = true;
          
          await OnlineUser.updateOne(
            { session_id: sessionId },
            { 
              $set: { 
                user_id: decoded.id,
                user_type: 'admin',
                username: decoded.username,
                email: decoded.email,
                last_activity: new Date()
              } 
            }
          );
        } else {
          req.customer = decoded;
          req.isAdmin = false;
          
          await OnlineUser.updateOne(
            { session_id: sessionId },
            { 
              $set: { 
                user_id: decoded.id,
                user_type: 'customer',
                username: decoded.name,
                email: decoded.email,
                last_activity: new Date()
              } 
            }
          );
        }
      }
    } catch (err) {
      console.error('Error updating session in auth middleware:', err);
      // Continue even if update fails
    }
    
    next();
  } catch {
    res.status(403).json({ message: 'Invalid or expired token' });
  }
};