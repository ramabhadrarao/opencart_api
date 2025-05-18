// controllers/dashboard.controller.js
import Order from '../models/order.model.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import OrderProduct from '../models/orderProduct.model.js';
import mongoose from 'mongoose';

// Helper function to get date X days ago
const getDateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// Get sales/revenue for a given period
export const getSalesRevenue = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30; // Default to 30 days
    const startDate = getDateDaysAgo(days);
    
    const result = await Order.aggregate([
      {
        $match: {
          date_added: { $gte: startDate },
          order_status_id: { $in: [3, 5] } // Shipped or Complete status
        }
      },
      {
        $group: {
          _id: null,
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: "$total" }
        }
      }
    ]);
    
    res.json({
      period: `${days} days`,
      start_date: startDate,
      end_date: new Date(),
      total_sales: result.length > 0 ? result[0].totalSales : 0,
      total_revenue: result.length > 0 ? Number(result[0].totalRevenue.toFixed(2)) : 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sales data', error: err.message });
  }
};

// Get new orders for a given period
export const getNewOrders = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7; // Default to 7 days
    const startDate = getDateDaysAgo(days);
    
    const orders = await Order.find({
      date_added: { $gte: startDate }
    }).sort({ date_added: -1 });
    
    res.json({
      period: `${days} days`,
      start_date: startDate,
      end_date: new Date(),
      total_orders: orders.length,
      orders: orders.map(order => ({
        order_id: order.order_id,
        customer: `${order.firstname} ${order.lastname}`,
        total: order.total,
        status_id: order.order_status_id,
        date_added: order.date_added
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching new orders', error: err.message });
  }
};

// Get new customers
export const getNewCustomers = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30; // Default to 30 days
    const startDate = getDateDaysAgo(days);
    
    const customers = await Customer.find({
      date_added: { $gte: startDate }
    }).sort({ date_added: -1 });
    
    res.json({
      period: `${days} days`,
      start_date: startDate,
      end_date: new Date(),
      total_new_customers: customers.length,
      customers: customers.map(customer => ({
        customer_id: customer.customer_id,
        name: `${customer.firstname} ${customer.lastname}`,
        email: customer.email,
        date_added: customer.date_added
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching new customers', error: err.message });
  }
};

// Get online customers (active in last 15 minutes)
export const getOnlineCustomers = async (req, res) => {
  try {
    // Since we don't have a direct "last activity" field in our MongoDB schema,
    // we would ideally track this in a separate collection
    // For now, this is a simplified version assuming we had that data
    const fifteenMinutesAgo = new Date();
    fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
    
    // This is a placeholder query - you'll need to implement actual activity tracking
    const onlineCustomers = await Customer.find({
      last_activity: { $gte: fifteenMinutesAgo }
    }).limit(100);
    
    // Alternative: If you're using the MySQL oc_customer_online table
    // You could implement a separate API endpoint or service that queries MySQL
    const mysql = await connectMySQL();
    const [rows] = await mysql.execute(`
      SELECT co.*, c.firstname, c.lastname, c.email 
      FROM oc_customer_online co
      LEFT JOIN oc_customer c ON co.customer_id = c.customer_id
      WHERE co.date_added > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
    `);
    await mysql.end();
    
    res.json({
      timestamp: new Date(),
      total_online: rows.length,
      customers: rows.map(row => ({
        customer_id: row.customer_id,
        name: row.customer_id ? `${row.firstname} ${row.lastname}` : 'Guest',
        ip: row.ip,
        url: row.url,
        referer: row.referer,
        last_activity: row.date_added
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching online customers', error: err.message });
  }
};

// Get revenue by year and month
export const getYearlyRevenue = async (req, res) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    
    const startDate = new Date(year, 0, 1); // January 1st of the requested year
    const endDate = new Date(year, 11, 31, 23, 59, 59); // December 31st
    
    const result = await Order.aggregate([
      {
        $match: {
          date_added: { $gte: startDate, $lte: endDate },
          order_status_id: { $in: [3, 5] } // Shipped or Complete status
        }
      },
      {
        $group: {
          _id: { $month: "$date_added" },
          totalRevenue: { $sum: "$total" },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Format the response with all 12 months
    const monthlyData = Array(12).fill().map((_, index) => {
      const month = index + 1;
      const foundMonth = result.find(item => item._id === month);
      
      return {
        month,
        month_name: new Date(year, index).toLocaleString('default', { month: 'long' }),
        revenue: foundMonth ? Number(foundMonth.totalRevenue.toFixed(2)) : 0,
        order_count: foundMonth ? foundMonth.orderCount : 0
      };
    });
    
    // Calculate yearly totals
    const yearlyRevenue = monthlyData.reduce((sum, month) => sum + month.revenue, 0);
    const yearlyOrderCount = monthlyData.reduce((sum, month) => sum + month.order_count, 0);
    
    res.json({
      year,
      total_revenue: Number(yearlyRevenue.toFixed(2)),
      total_orders: yearlyOrderCount,
      monthly_data: monthlyData
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching yearly revenue', error: err.message });
  }
};

// Get top selling products
export const getTopProducts = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30; // Default to 30 days
    const limit = parseInt(req.query.limit) || 10; // Default to top 10
    const startDate = getDateDaysAgo(days);
    
    // Find orders from the period
    const orders = await Order.find({
      date_added: { $gte: startDate },
      order_status_id: { $in: [3, 5] } // Shipped or Complete status
    }).select('order_id');
    
    const orderIds = orders.map(order => order.order_id);
    
    // Aggregate product sales from these orders
    const topProducts = await OrderProduct.aggregate([
      {
        $match: {
          order_id: { $in: orderIds }
        }
      },
      {
        $group: {
          _id: "$product_id",
          name: { $first: "$name" },
          model: { $first: "$model" },
          total_quantity: { $sum: "$quantity" },
          total_sales: { $sum: { $multiply: ["$price", "$quantity"] } }
        }
      },
      {
        $sort: { total_sales: -1 }
      },
      {
        $limit: limit
      }
    ]);
    
    // Get more product details if needed
    const enrichedProducts = await Promise.all(topProducts.map(async (product) => {
      const productDetails = await Product.findOne({ product_id: product._id });
      return {
        product_id: product._id,
        name: product.name,
        model: product.model,
        image: productDetails?.image || '',
        quantity_sold: product.total_quantity,
        total_sales: Number(product.total_sales.toFixed(2))
      };
    }));
    
    res.json({
      period: `${days} days`,
      start_date: startDate,
      end_date: new Date(),
      top_products: enrichedProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching top products', error: err.message });
  }
};

// Get recent orders with details
export const getRecentOrders = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10; // Default to 10 most recent orders
    
    // Get recent orders
    const orders = await Order.find()
      .sort({ date_added: -1 })
      .limit(limit);
    
    // Enrich with product details
    const ordersWithDetails = await Promise.all(orders.map(async (order) => {
      const products = await OrderProduct.find({ order_id: order.order_id });
      
      return {
        order_id: order.order_id,
        customer: {
          name: `${order.firstname} ${order.lastname}`,
          email: order.email,
          telephone: order.telephone
        },
        total: order.total,
        date_added: order.date_added,
        status_id: order.order_status_id,
        payment_method: order.payment_method,
        shipping_method: order.shipping_method,
        products: products.map(product => ({
          product_id: product.product_id,
          name: product.name,
          model: product.model,
          quantity: product.quantity,
          price: product.price,
          total: product.total
        }))
      };
    }));
    
    res.json({
      count: ordersWithDetails.length,
      orders: ordersWithDetails
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching recent orders', error: err.message });
  }
};