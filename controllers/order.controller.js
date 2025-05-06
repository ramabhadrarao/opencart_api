// controllers/order.controller.js
import Order from '../models/order.model.js';

export const getCustomerOrders = async (req, res) => {
  try {
    const customerId = req.customer.id;

    const orders = await Order.find({ customer_id: customerId }).sort({ date_added: -1 });

    res.json({
      count: orders.length,
      orders
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching orders', error: err.message });
  }
};
