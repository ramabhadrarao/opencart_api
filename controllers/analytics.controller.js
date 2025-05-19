// controllers/analytics.controller.js
import OnlineUser from '../models/onlineUser.model.js';
import UserActivity from '../models/userActivity.model.js';
import SearchLog from '../models/searchLog.model.js';
import AuditLog from '../models/auditLog.model.js';
import Product from '../models/product.model.js';
import Customer from '../models/customer.model.js';
import Order from '../models/order.model.js';

/**
 * Get currently online users
 * @route GET /api/analytics/online-users
 * @access Admin only
 */
export const getOnlineUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Apply filters if provided
    const filters = {};
    
    if (req.query.user_type) {
      filters.user_type = req.query.user_type;
    }
    
    if (req.query.country) {
      filters['location.country'] = req.query.country;
    }
    
    // Get online users with pagination
    const onlineUsers = await OnlineUser.find(filters)
      .sort({ last_activity: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await OnlineUser.countDocuments(filters);
    
    // Get summary counts
    const customerCount = await OnlineUser.countDocuments({ user_type: 'customer' });
    const adminCount = await OnlineUser.countDocuments({ user_type: 'admin' });
    const guestCount = await OnlineUser.countDocuments({ user_type: 'guest' });
    
    // Enrich user data
    const enrichedUsers = await Promise.all(onlineUsers.map(async (user) => {
      // Get additional data for logged-in users
      let additionalData = {};
      
      if (user.user_id && user.user_type === 'customer') {
        try {
          const customer = await Customer.findOne({ customer_id: user.user_id });
          if (customer) {
            additionalData = {
              customer_since: customer.date_added,
              telephone: customer.telephone
            };
          }
        } catch (err) {
          console.error(`Error fetching customer data for ID ${user.user_id}:`, err);
        }
      }
      
      return {
        id: user._id,
        user_id: user.user_id,
        user_type: user.user_type,
        username: user.username,
        email: user.email,
        session_id: user.session_id,
        ip_address: user.ip_address,
        location: user.location,
        browser: user.browser,
        operating_system: user.operating_system,
        device_type: user.device_type,
        current_url: user.current_url,
        entry_page: user.entry_page,
        referrer: user.referrer,
        page_views: user.page_views,
        last_activity: user.last_activity,
        ...additionalData
      };
    }));
    
    res.json({
      online_users: enrichedUsers,
      summary: {
        total: total,
        customers: customerCount,
        admins: adminCount,
        guests: guestCount
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching online users', error: err.message });
  }
};

/**
 * Get user activity logs
 * @route GET /api/analytics/user-activity
 * @access Admin only
 */
export const getUserActivity = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Apply filters if provided
    const filters = {};
    
    if (req.query.user_id) {
      filters.user_id = parseInt(req.query.user_id);
    }
    
    if (req.query.user_type) {
      filters.user_type = req.query.user_type;
    }
    
    if (req.query.activity_type) {
      filters.activity_type = req.query.activity_type;
    }
    
    if (req.query.ip_address) {
      filters.ip_address = req.query.ip_address;
    }
    
    if (req.query.date_from || req.query.date_to) {
      filters.created_at = {};
      
      if (req.query.date_from) {
        filters.created_at.$gte = new Date(req.query.date_from);
      }
      
      if (req.query.date_to) {
        filters.created_at.$lte = new Date(req.query.date_to);
      }
    }
    
    // Get activity logs with pagination
    const activities = await UserActivity.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await UserActivity.countDocuments(filters);
    
    // Get summary counts by activity type
    const activityCounts = await UserActivity.aggregate([
      { $match: filters },
      { $group: { _id: '$activity_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const summary = {
      total,
      by_activity: Object.fromEntries(
        activityCounts.map(item => [item._id, item.count])
      )
    };
    
    res.json({
      activities,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user activity', error: err.message });
  }
};

/**
 * Get search analytics
 * @route GET /api/analytics/searches
 * @access Admin only
 */
export const getSearchAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Apply filters
    const filters = {
      created_at: { $gte: startDate }
    };
    
    if (req.query.query) {
      filters.query = { $regex: req.query.query, $options: 'i' };
    }
    
    // Get search logs with pagination
    const searches = await SearchLog.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await SearchLog.countDocuments(filters);
    
    // Get popular search terms
    const popularSearches = await SearchLog.aggregate([
      { $match: filters },
      { $group: { 
        _id: { $toLower: '$query' }, 
        count: { $sum: 1 },
        avg_results: { $avg: '$results_count' },
        last_searched: { $max: '$created_at' }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: {
        _id: 0,
        query: '$_id',
        count: 1,
        avg_results: { $round: ['$avg_results', 0] },
        last_searched: 1
      }}
    ]);
    
    // Get searches with zero results
    const zeroResultSearches = await SearchLog.aggregate([
      { $match: { ...filters, results_count: 0 } },
      { $group: { 
        _id: { $toLower: '$query' }, 
        count: { $sum: 1 },
        last_searched: { $max: '$created_at' }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $project: {
        _id: 0,
        query: '$_id',
        count: 1,
        last_searched: 1
      }}
    ]);
    
    // Search trends by day
    const searchesByDay = await SearchLog.aggregate([
      { $match: filters },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
        count: { $sum: 1 },
        unique_terms: { $addToSet: { $toLower: '$query' } }
      }},
      { $sort: { _id: 1 } },
      { $project: {
        _id: 0,
        date: '$_id',
        count: 1,
        unique_terms: { $size: '$unique_terms' }
      }}
    ]);
    
    res.json({
      period: `${days} days`,
      searches,
      summary: {
        total_searches: total,
        popular_searches: popularSearches,
        zero_result_searches: zeroResultSearches,
        searches_by_day: searchesByDay
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching search analytics', error: err.message });
  }
};

/**
 * Get audit logs
 * @route GET /api/analytics/audit-logs
 * @access Admin only
 */
export const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Apply filters if provided
    const filters = {};
    
    if (req.query.user_id) {
      filters.user_id = parseInt(req.query.user_id);
    }
    
    if (req.query.user_type) {
      filters.user_type = req.query.user_type;
    }
    
    if (req.query.action) {
      filters.action = req.query.action;
    }
    
    if (req.query.entity_type) {
      filters.entity_type = req.query.entity_type;
    }
    
    if (req.query.entity_id) {
      filters.entity_id = req.query.entity_id;
    }
    
    if (req.query.date_from || req.query.date_to) {
      filters.created_at = {};
      
      if (req.query.date_from) {
        filters.created_at.$gte = new Date(req.query.date_from);
      }
      
      if (req.query.date_to) {
        filters.created_at.$lte = new Date(req.query.date_to);
      }
    }
    
    // Get audit logs with pagination
    const auditLogs = await AuditLog.find(filters)
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await AuditLog.countDocuments(filters);
    
    // Get summary counts by action
    const actionCounts = await AuditLog.aggregate([
      { $match: filters },
      { $group: { _id: '$action', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get summary counts by entity type
    const entityTypeCounts = await AuditLog.aggregate([
      { $match: filters },
      { $group: { _id: '$entity_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const summary = {
      total,
      by_action: Object.fromEntries(
        actionCounts.map(item => [item._id, item.count])
      ),
      by_entity_type: Object.fromEntries(
        entityTypeCounts.map(item => [item._id, item.count])
      )
    };
    
    res.json({
      audit_logs: auditLogs,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching audit logs', error: err.message });
  }
};

/**
 * Get user location analytics
 * @route GET /api/analytics/user-locations
 * @access Admin only
 */
export const getUserLocations = async (req, res) => {
  try {
    // Get timeframe
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Apply filters
    const filters = {
      last_activity: { $gte: startDate }
    };
    
    if (req.query.user_type) {
      filters.user_type = req.query.user_type;
    }
    
    // Get users by country
    const countryCounts = await OnlineUser.aggregate([
      { $match: filters },
      { $group: { _id: '$location.country', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    
    // Get users by city
    const cityCounts = await OnlineUser.aggregate([
      { $match: filters },
      { $group: { 
        _id: { 
          city: '$location.city', 
          country: '$location.country' 
        }, 
        count: { $sum: 1 },
        lat: { $first: '$location.latitude' },
        lng: { $first: '$location.longitude' }
      }},
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $project: {
        _id: 0,
        city: '$_id.city',
        country: '$_id.country',
        count: 1,
        latitude: '$lat',
        longitude: '$lng'
      }}
    ]);
    
    // Get users by region
    const regionCounts = await OnlineUser.aggregate([
      { $match: filters },
      { $group: { 
        _id: { 
          region: '$location.region', 
          country: '$location.country' 
        }, 
        count: { $sum: 1 } 
      }},
      { $sort: { count: -1 } },
      { $limit: 20 },
      { $project: {
        _id: 0,
        region: '$_id.region',
        country: '$_id.country',
        count: 1
      }}
    ]);
    
    res.json({
      period: `${days} days`,
      by_country: countryCounts.map(item => ({
        country: item._id || 'Unknown',
        count: item.count
      })),
      by_city: cityCounts,
      by_region: regionCounts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user locations', error: err.message });
  }
};

/**
 * Get system overview statistics
 * @route GET /api/analytics/overview
 * @access Admin only
 */
export const getSystemOverview = async (req, res) => {
  try {
    // Get current date and date 30 days ago
    const currentDate = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Count online users (active in the last 15 minutes by default)
    const onlineUsers = await OnlineUser.countDocuments();
    const onlineCustomers = await OnlineUser.countDocuments({ user_type: 'customer' });
    const onlineGuests = await OnlineUser.countDocuments({ user_type: 'guest' });
    
    // Count total entities
    const totalProducts = await Product.countDocuments();
    const totalCustomers = await Customer.countDocuments();
    const totalOrders = await Order.countDocuments();
    
    // New entities in the last 30 days
    const newProducts = await Product.countDocuments({ date_added: { $gte: thirtyDaysAgo } });
    const newCustomers = await Customer.countDocuments({ date_added: { $gte: thirtyDaysAgo } });
    const newOrders = await Order.countDocuments({ date_added: { $gte: thirtyDaysAgo } });
    
    // Total searches in the last 30 days
    const totalSearches = await SearchLog.countDocuments({ created_at: { $gte: thirtyDaysAgo } });
    
    // Most viewed products in the last 30 days
    const productViews = await UserActivity.aggregate([
      { 
        $match: { 
          activity_type: 'view_product',
          created_at: { $gte: thirtyDaysAgo }
        } 
      },
      { 
        $group: { 
          _id: '$activity_data.product_id', 
          views: { $sum: 1 } 
        } 
      },
      { $sort: { views: -1 } },
      { $limit: 5 }
    ]);
    
    // Enrich with product details
    const topProducts = await Promise.all(productViews.map(async (item) => {
      if (!item._id) return { product_id: 'unknown', name: 'Unknown Product', views: item.views };
      
      const product = await Product.findOne({ product_id: item._id });
      if (!product) return { product_id: item._id, name: 'Unknown Product', views: item.views };
      
      const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || 'Unknown Product',
        views: item.views
      };
    }));
    
    res.json({
      timestamp: new Date(),
      online: {
        total: onlineUsers,
        customers: onlineCustomers,
        guests: onlineGuests
      },
      totals: {
        products: totalProducts,
        customers: totalCustomers,
        orders: totalOrders,
        searches_30d: totalSearches
      },
      new_30d: {
        products: newProducts,
        customers: newCustomers,
        orders: newOrders
      },
      top_products: topProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching system overview', error: err.message });
  }
};