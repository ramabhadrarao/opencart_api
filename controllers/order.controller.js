// controllers/order.controller.js - ENHANCED VERSION
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import auditLogService from '../utils/auditLogService.js';

// Get customer orders with full details
export const getCustomerOrders = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Get orders with embedded products (leveraging your embedded structure)
    const orders = await Order.find({ customer_id: customerId })
      .sort({ date_added: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Order.countDocuments({ customer_id: customerId });

    // Format orders with embedded product data
    const formattedOrders = orders.map(order => ({
      order_id: order.order_id,
      total: order.total,
      order_status_id: order.order_status_id,
      date_added: order.date_added,
      date_modified: order.date_modified,
      payment_method: order.payment_method,
      shipping_method: order.shipping_method,
      comment: order.comment,
      // Use embedded products from your model
      products: order.products || [],
      product_count: order.products?.length || 0,
      tracking: order.tracking,
      currency_code: order.currency_code || 'USD'
    }));

    res.json({
      orders: formattedOrders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err.message });
  }
};

// Get detailed order by ID
export const getOrderDetails = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const orderId = parseInt(req.params.id);

    const order = await Order.findOne({ 
      order_id: orderId,
      customer_id: customerId 
    }).lean();

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Enhanced order details with embedded products
    const orderDetails = {
      order_id: order.order_id,
      invoice_no: order.invoice_no,
      total: order.total,
      order_status_id: order.order_status_id,
      date_added: order.date_added,
      date_modified: order.date_modified,
      
      // Customer info
      customer: {
        firstname: order.firstname,
        lastname: order.lastname,
        email: order.email,
        telephone: order.telephone
      },
      
      // Payment details
      payment: {
        method: order.payment_method,
        code: order.payment_code,
        address: {
          firstname: order.payment_firstname,
          lastname: order.payment_lastname,
          company: order.payment_company,
          address_1: order.payment_address_1,
          address_2: order.payment_address_2,
          city: order.payment_city,
          postcode: order.payment_postcode,
          country: order.payment_country,
          zone: order.payment_zone
        }
      },
      
      // Shipping details
      shipping: {
        method: order.shipping_method,
        code: order.shipping_code,
        address: {
          firstname: order.shipping_firstname,
          lastname: order.shipping_lastname,
          company: order.shipping_company,
          address_1: order.shipping_address_1,
          address_2: order.shipping_address_2,
          city: order.shipping_city,
          postcode: order.shipping_postcode,
          country: order.shipping_country,
          zone: order.shipping_zone
        }
      },
      
      // Products from embedded structure
      products: order.products || [],
      
      // Order history and totals
      history: order.history || [],
      totals: order.totals || [],
      tracking: order.tracking,
      comment: order.comment
    };

    res.json(orderDetails);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching order details', error: err.message });
  }
};

// Admin: Get all orders with advanced filtering
export const getAllOrders = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query filters
    const filters = {};
    
    if (req.query.status) {
      filters.order_status_id = parseInt(req.query.status);
    }
    
    if (req.query.customer_id) {
      filters.customer_id = parseInt(req.query.customer_id);
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

    if (req.query.search) {
      filters.$or = [
        { firstname: { $regex: req.query.search, $options: 'i' } },
        { lastname: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
        { order_id: parseInt(req.query.search) || 0 }
      ];
    }

    const orders = await Order.find(filters)
      .sort({ date_added: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Order.countDocuments(filters);

    // Calculate summary statistics
    const stats = await Order.aggregate([
      { $match: filters },
      {
        $group: {
          _id: null,
          total_amount: { $sum: '$total' },
          avg_amount: { $avg: '$total' },
          order_count: { $sum: 1 }
        }
      }
    ]);

    const summary = stats[0] || { total_amount: 0, avg_amount: 0, order_count: 0 };

    res.json({
      orders: orders.map(order => ({
        order_id: order.order_id,
        customer_name: `${order.firstname} ${order.lastname}`,
        email: order.email,
        total: order.total,
        order_status_id: order.order_status_id,
        payment_method: order.payment_method,
        date_added: order.date_added,
        product_count: order.products?.length || 0
      })),
      summary: {
        total_orders: summary.order_count,
        total_amount: Number(summary.total_amount.toFixed(2)),
        average_amount: Number(summary.avg_amount.toFixed(2))
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err.message });
  }
};

// Admin: Update order status
export const updateOrderStatus = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orderId = parseInt(req.params.id);
    const { order_status_id, comment, notify_customer } = req.body;

    if (!order_status_id) {
      return res.status(400).json({ message: 'Order status ID is required' });
    }

    const order = await Order.findOne({ order_id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Store original for audit
    const originalOrder = order.toObject();

    // Update order status
    const previousStatus = order.order_status_id;
    order.order_status_id = order_status_id;
    order.date_modified = new Date();

    // Add to history
    if (!order.history) {
      order.history = [];
    }

    order.history.push({
      order_history_id: (order.history.length + 1),
      order_status_id,
      notify: notify_customer || false,
      comment: comment || '',
      date_added: new Date()
    });

    await order.save();

    // Log audit trail
    auditLogService.logUpdate(req, 'order', originalOrder, order.toObject(), 
      `Order status changed from ${previousStatus} to ${order_status_id}`);

    // TODO: Send notification email if notify_customer is true
    // if (notify_customer) {
    //   await sendOrderStatusEmail(order);
    // }

    res.json({
      message: 'Order status updated successfully',
      order_id: orderId,
      old_status: previousStatus,
      new_status: order_status_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating order status', error: err.message });
  }
};

// Admin: Get order analytics
export const getOrderAnalytics = async (req, res) => {
  try {
    // Ensure admin access
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $match: { date_added: { $gte: startDate } } },
      { $group: { _id: '$order_status_id', count: { $sum: 1 }, total: { $sum: '$total' } } },
      { $sort: { _id: 1 } }
    ]);

    // Orders by day
    const ordersByDay = await Order.aggregate([
      { $match: { date_added: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date_added' } },
          count: { $sum: 1 },
          total: { $sum: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Top products from embedded data
    const topProducts = await Order.aggregate([
      { $match: { date_added: { $gte: startDate } } },
      { $unwind: '$products' },
      {
        $group: {
          _id: '$products.product_id',
          name: { $first: '$products.name' },
          total_quantity: { $sum: '$products.quantity' },
          total_revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } }
        }
      },
      { $sort: { total_quantity: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      period: `${days} days`,
      summary: {
        by_status: ordersByStatus,
        by_day: ordersByDay,
        top_products: topProducts
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching order analytics', error: err.message });
  }
};

// Get order status options (for dropdowns)
export const getOrderStatuses = async (req, res) => {
  try {
    // These would typically come from a status table, but for now return common statuses
    const statuses = [
      { id: 1, name: 'Pending' },
      { id: 2, name: 'Processing' },
      { id: 3, name: 'Shipped' },
      { id: 4, name: 'Delivered' },
      { id: 5, name: 'Complete' },
      { id: 7, name: 'Canceled' },
      { id: 8, name: 'Denied' },
      { id: 9, name: 'Canceled Reversal' },
      { id: 10, name: 'Failed' },
      { id: 11, name: 'Refunded' },
      { id: 12, name: 'Reversed' },
      { id: 13, name: 'Chargeback' },
      { id: 14, name: 'Expired' },
      { id: 15, name: 'Processed' },
      { id: 16, name: 'Voided' }
    ];

    res.json({ statuses });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching order statuses', error: err.message });
  }
};

export default {
  getCustomerOrders,
  getOrderDetails,
  getAllOrders,
  updateOrderStatus,
  getOrderAnalytics,
  getOrderStatuses
};