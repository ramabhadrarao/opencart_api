// middleware/activityTracker.middleware.js
import UserActivity from '../models/userActivity.model.js';
import OnlineUser from '../models/onlineUser.model.js';
import geoLocationService from '../utils/geoLocationService.js';
import { v4 as uuidv4 } from 'uuid';
// Fix for ua-parser-js import
import * as uaParserModule from 'ua-parser-js';
const UAParser = uaParserModule.UAParser || uaParserModule.default;
import dotenv from 'dotenv';

dotenv.config();

/**
 * Extract client IP from request
 * @param {Object} req - Express request object
 * @returns {string} - Client IP address
 */
const getClientIp = (req) => {
  // Get IP considering proxies (like Cloudflare, Nginx, etc.)
  const ip = req.headers['x-forwarded-for'] || 
             req.headers['x-real-ip'] || 
             req.connection.remoteAddress || 
             req.socket.remoteAddress || 
             '';
  
  // If multiple IPs in x-forwarded-for, get the first one (client IP)
  return ip.split(',')[0].trim();
};

/**
 * Parse user agent to get browser, OS, device info
 * @param {string} userAgent - User agent string
 * @returns {Object} - Parsed user agent data
 */
const parseUserAgent = (userAgent) => {
  if (!userAgent) {
    return {
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown'
    };
  }
  
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  
  return {
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    operating_system: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    device_type: result.device.type || (result.device.vendor ? 'Mobile' : 'Desktop')
  };
};

/**
 * Create or update online user record
 * @param {Object} req - Express request object 
 * @param {Object} userData - User data including ID, type, username
 * @param {Object} locationData - Geolocation data
 * @returns {Promise<Object>} - Online user record
 */
const trackOnlineUser = async (req, userData, locationData) => {
  // Get or set session ID
  let sessionId = req.cookies?.session_id;
  if (!sessionId) {
    sessionId = uuidv4();
    // Set cookie if not in middleware response
    if (req.res) {
      req.res.cookie('session_id', sessionId, { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        sameSite: 'lax'
      });
    }
    console.log(`New session created: ${sessionId}`);
  }
  
  // Get client info
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'];
  const referrer = req.headers.referer || req.headers.referrer || '';
  const currentUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const { browser, operating_system, device_type } = parseUserAgent(userAgent);
  
  try {
    // Try to find existing session
    let onlineUser = await OnlineUser.findOne({ session_id: sessionId });
    
    if (onlineUser) {
      // Update existing user
      const updateData = {
        last_activity: new Date(),
        current_url: currentUrl,
        page_views: onlineUser.page_views + 1
      };
      
      // Only update user data if it's a logged-in user (not guest)
      if (userData.user_id) {
        updateData.user_id = userData.user_id;
        updateData.user_type = userData.user_type;
        updateData.username = userData.username;
        updateData.email = userData.email;
      }
      
      // Update the document with atomic operation
      await OnlineUser.updateOne(
        { session_id: sessionId },
        { $set: updateData }
      );
      
    } else {
      // Create new online user record
      onlineUser = new OnlineUser({
        session_id: sessionId,
        ip_address: ip,
        location: {
          country: locationData.country,
          region: locationData.region,
          city: locationData.city,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timezone: locationData.timezone
        },
        user_agent: userAgent,
        browser,
        operating_system,
        device_type,
        current_url: currentUrl,
        entry_page: currentUrl,
        referrer,
        last_activity: new Date(),
        
        // User data if logged in
        user_id: userData.user_id || null,
        user_type: userData.user_type || 'guest',
        username: userData.username || null,
        email: userData.email || null
      });
      
      await onlineUser.save();
    }
    
    return onlineUser;
  } catch (error) {
    console.error('Error tracking online user:', error);
    return null;
  }
};
/**
 * Log user activity
 * @param {Object} req - Express request object
 * @param {string} activityType - Type of activity
 * @param {Object} activityData - Additional activity data
 * @param {Object} userData - User data
 * @param {Object} locationData - Geolocation data
 * @returns {Promise<Object>} - User activity record
 */
const logActivity = async (req, activityType, activityData = {}, userData = {}, locationData = {}) => {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'];
  const referrer = req.headers.referer || req.headers.referrer || '';
  const sessionId = req.cookies?.session_id || 'unknown';
  
  try {
    const activity = new UserActivity({
      user_id: userData.user_id || null,
      user_type: userData.user_type || 'guest',
      session_id: sessionId,
      ip_address: ip,
      location: locationData,
      user_agent: userAgent,
      referrer,
      activity_type: activityType,
      activity_data: activityData,
      last_activity: new Date(),
      created_at: new Date()
    });
    
    await activity.save();
    return activity;
  } catch (error) {
    console.error(`Error logging ${activityType} activity:`, error);
    return null;
  }
};

/**
 * Main activity tracking middleware
 */
export const activityTracker = async (req, res, next) => {
  // Skip tracking for certain paths
  const skipPaths = [
    '/api-docs', 
    '/favicon.ico', 
    '/static', 
    '/assets',
    '/health'
  ];
  
  const shouldSkip = skipPaths.some(path => req.path.startsWith(path));
  if (shouldSkip) {
    return next();
  }

  // Save original end method to capture response data
  const originalEnd = res.end;
  
  try {
    // Get client IP
    const ip = getClientIp(req);
    
    // Get user data
    let userData = {
      user_id: null,
      user_type: 'guest',
      username: null,
      email: null
    };
    
    // Check if customer is logged in
    if (req.customer) {
      userData = {
        user_id: req.customer.id,
        user_type: 'customer',
        username: req.customer.name,
        email: req.customer.email
      };
    } 
    // Check if admin is logged in
    else if (req.admin) {
      userData = {
        user_id: req.admin.id,
        user_type: 'admin',
        username: req.admin.username,
        email: req.admin.email
      };
    }
    
    // Get geolocation data
    const locationData = await geoLocationService.getLocationFromIp(ip);
    
    // Track online user
    await trackOnlineUser(req, userData, locationData);
    
    // Intercept response to log activity after request is complete
    res.end = async function(...args) {
      // Call the original end method
      originalEnd.apply(res, args);
      
      // Determine activity type based on request
      let activityType = 'other';
      let activityData = {
        method: req.method,
        path: req.path,
        status: res.statusCode
      };
      
      // Login activity - Special handling to capture user info from response
      // Login activity - Special handling to capture user info from response
      if (req.path.includes('/login') && req.method === 'POST' && res.statusCode === 200) {
        activityType = 'login';
        
        // Try to extract user info from response body
        try {
          const resBody = res._body;
          
          if (resBody && typeof resBody === 'string') {
            const jsonBody = JSON.parse(resBody);
            
            // Check if customer login or admin login
            if (jsonBody.customer) {
              // Update userData with details from response for customer login
              userData = {
                user_id: jsonBody.customer.id,
                user_type: 'customer',  // Explicitly set as customer
                username: jsonBody.customer.name,
                email: jsonBody.customer.email
              };
              
              // Add login details to activity data
              activityData.user_id = jsonBody.customer.id;
              activityData.email = jsonBody.customer.email;
              
              // Also update the online user record for this session
              const sessionId = req.cookies?.session_id || 'unknown';
              try {
                // Use updateOne instead of findOneAndUpdate for consistency
                const result = await OnlineUser.updateOne(
                  { session_id: sessionId },
                  { 
                    $set: { 
                      user_id: jsonBody.customer.id,
                      user_type: 'customer',  // Explicitly set as customer
                      username: jsonBody.customer.name,
                      email: jsonBody.customer.email,
                      last_activity: new Date()
                    }
                  },
                  { upsert: true }
                );
                
                console.log('Updated online user after customer login:', {
                  user_id: jsonBody.customer.id,
                  user_type: 'customer',  // Log the type
                  session_id: sessionId
                });
              } catch (err) {
                console.error('Error updating online user after login:', err);
              }
            } else if (jsonBody.admin) {
              // Update userData with details from response for admin login
              userData = {
                user_id: jsonBody.admin.id,
                user_type: 'admin',  // Explicitly set as admin
                username: jsonBody.admin.username,
                email: jsonBody.admin.email
              };
              
              // Add login details to activity data
              activityData.user_id = jsonBody.admin.id;
              activityData.email = jsonBody.admin.email;
              
              // Also update the online user record for this session
              const sessionId = req.cookies?.session_id || 'unknown';
              try {
                // Use updateOne instead of findOneAndUpdate for consistency
                const result = await OnlineUser.updateOne(
                  { session_id: sessionId },
                  { 
                    $set: { 
                      user_id: jsonBody.admin.id,
                      user_type: 'admin',  // Explicitly set as admin
                      username: jsonBody.admin.username,
                      email: jsonBody.admin.email,
                      last_activity: new Date()
                    }
                  },
                  { upsert: true }
                );
                
                console.log('Updated online user after admin login:', {
                  user_id: jsonBody.admin.id,
                  user_type: 'admin',  // Log the type
                  session_id: sessionId
                });
              } catch (err) {
                console.error('Error updating online user after login:', err);
              }
            }
          }
        } catch (e) {
          // Silently catch parsing errors
          console.error('Error parsing login response:', e);
        }
      }
      // Logout activity
      else if (req.path.includes('/logout') && res.statusCode === 200) {
        activityType = 'logout';
      }
      // Product view
      else if (req.path.match(/\/products\/\d+/) && req.method === 'GET') {
        activityType = 'view_product';
        activityData.product_id = parseInt(req.path.split('/').pop());
      }
      // Search
      else if (req.path.includes('/search') && req.method === 'GET') {
        activityType = 'search';
        activityData.query = req.query.query || '';
        activityData.filters = { ...req.query };
      }
      // Add to cart
      else if (req.path.includes('/cart/add') && req.method === 'POST') {
        activityType = 'add_to_cart';
        activityData.product_id = req.body.product_id;
        activityData.quantity = req.body.quantity;
      }
      // Checkout
      else if (req.path.includes('/checkout') && req.method === 'POST') {
        activityType = 'checkout';
      }
      // Order
      else if (req.path.includes('/checkout/complete') && req.method === 'POST' && res.statusCode === 200) {
        activityType = 'order';
        // Try to extract order_id from response
        try {
          const resBody = res._body;
          if (resBody && typeof resBody === 'string') {
            const jsonBody = JSON.parse(resBody);
            if (jsonBody.order_id) {
              activityData.order_id = jsonBody.order_id;
            }
          }
        } catch (e) {
          // Silently catch parsing errors
        }
      }
      // Registration
      else if (req.path.includes('/register') && req.method === 'POST' && res.statusCode === 201) {
        activityType = 'register';
        // Try to extract user info from response body
        try {
          const resBody = res._body;
          if (resBody && typeof resBody === 'string') {
            const jsonBody = JSON.parse(resBody);
            if (jsonBody.customer) {
              // Update userData with details from response
              userData = {
                user_id: jsonBody.customer.id,
                user_type: 'customer',
                username: jsonBody.customer.name,
                email: jsonBody.customer.email
              };
              
              // Add registration details to activity data
              activityData.user_id = jsonBody.customer.id;
              activityData.email = jsonBody.customer.email;
            }
          }
        } catch (e) {
          // Silently catch parsing errors
        }
      }
      
      // Log the activity asynchronously
      logActivity(req, activityType, activityData, userData, locationData)
        .catch(err => console.error('Error in activity logging:', err));
    };
  } catch (error) {
    console.error('Error in activity tracker middleware:', error);
    // Continue with the request even if tracking fails
  }
  
  next();
};

// Export methods for direct use in controllers
export { trackOnlineUser, logActivity, getClientIp };