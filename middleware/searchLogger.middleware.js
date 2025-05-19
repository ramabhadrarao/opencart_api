// middleware/searchLogger.middleware.js
import SearchLog from '../models/searchLog.model.js';
import { getClientIp } from './activityTracker.middleware.js';
import geoLocationService from '../utils/geoLocationService.js';

/**
 * Middleware to log search queries
 */
export const searchLogger = async (req, res, next) => {
  // Save original end method
  const originalEnd = res.end;
  
  // Replace end method
  res.end = async function(...args) {
    // Call original end first to finish the response
    originalEnd.apply(res, args);
    
    try {
      // Only process if it's a search request and successful
      if (!req.path.includes('/search') || res.statusCode !== 200) {
        return;
      }
      
      // Extract search query and parameters
      const query = req.query.query || '';
      
      // Skip logging empty queries
      if (!query.trim()) {
        return;
      }
      
      // Get result count if available
      let resultsCount = 0;
      try {
        const resBody = res._body;
        if (resBody && typeof resBody === 'string') {
          const jsonBody = JSON.parse(resBody);
          resultsCount = jsonBody.pagination?.total || 0;
        }
      } catch (e) {
        // Silently catch parsing errors
      }
      
      // Gather user data
      let userId = null;
      let userType = 'guest';
      
      if (req.customer) {
        userId = req.customer.id;
        userType = 'customer';
      } else if (req.admin) {
        userId = req.admin.id;
        userType = 'admin';
      }
      
      const sessionId = req.cookies?.session_id || null;
      const ip = getClientIp(req);
      
      // Get geolocation data
      const locationData = await geoLocationService.getLocationFromIp(ip);
      
      // Create search log entry
      const searchLog = new SearchLog({
        user_id: userId,
        user_type: userType,
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
        query,
        filters: {
          category: req.query.category,
          price_min: req.query.price_min,
          price_max: req.query.price_max,
          sort: req.query.sort
        },
        results_count: resultsCount,
        category_id: req.query.category ? parseInt(req.query.category) : null,
        sort_option: req.query.sort || 'relevance',
        page: parseInt(req.query.page) || 1,
        created_at: new Date()
      });
      
      await searchLog.save();
    } catch (error) {
      console.error('Error logging search:', error);
      // Don't affect the response if logging fails
    }
  };
  
  next();
};