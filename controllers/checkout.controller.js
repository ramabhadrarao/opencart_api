// controllers/checkout.controller.js
import Checkout from '../models/checkout.model.js';
import Cart from '../models/cart.model.js';
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';

// Start a checkout process
export const startCheckout = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Get customer details
    const customer = await Customer.findOne({ customer_id: customerId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get cart
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    // Validate cart items (check stock, etc.)
    let validationErrors = [];
    let total = 0;
    
    for (const item of cart.items) {
      const product = await Product.findOne({ product_id: item.product_id, status: true });
      
      if (!product) {
        validationErrors.push(`Product ${item.name} is no longer available`);
        continue;
      }
      
      if (product.subtract && item.quantity > product.quantity) {
        validationErrors.push(`Insufficient stock for ${item.name}. Available: ${product.quantity}`);
      }
      
      total += item.final_price * item.quantity;
    }
    
    if (validationErrors.length) {
      return res.status(400).json({ 
        message: 'Cart validation failed', 
        errors: validationErrors 
      });
    }
    
    // Create checkout session
    const checkout = new Checkout({
      customer_id: customerId,
      cart_id: cart._id,
      total: parseFloat(total.toFixed(2)),
      ip_address: req.ip
    });
    
    await checkout.save();
    
    res.json({
      checkout_id: checkout._id,
      total: checkout.total,
      items_count: cart.items.length,
      customer: {
        customer_id: customer.customer_id,
        name: `${customer.firstname} ${customer.lastname}`,
        email: customer.email
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error starting checkout', error: err.message });
  }
};

// Add shipping method to checkout
export const addShippingMethod = async (req, res) => {
  try {
    const { checkout_id, shipping_method, shipping_code } = req.body;
    
    if (!checkout_id || !shipping_method || !shipping_code) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const checkout = await Checkout.findById(checkout_id);
    if (!checkout) {
      return res.status(404).json({ message: 'Checkout session not found' });
    }
    
    // Verify customer owns this checkout
    if (checkout.customer_id !== req.customer.id) {
      return res.status(403).json({ message: 'Not authorized to modify this checkout' });
    }
    
    // Update checkout
    checkout.shipping_method = shipping_method;
    checkout.shipping_code = shipping_code;
    checkout.date_modified = Date.now();
    
    await checkout.save();
    
    res.json({
      message: 'Shipping method added',
      checkout
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding shipping method', error: err.message });
  }
};

// Add payment method to checkout
export const addPaymentMethod = async (req, res) => {
  try {
    const { checkout_id, payment_method, payment_code } = req.body;
    
    if (!checkout_id || !payment_method || !payment_code) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    const checkout = await Checkout.findById(checkout_id);
    if (!checkout) {
      return res.status(404).json({ message: 'Checkout session not found' });
    }
    
    // Verify customer owns this checkout
    if (checkout.customer_id !== req.customer.id) {
      return res.status(403).json({ message: 'Not authorized to modify this checkout' });
    }
    
    // Update checkout
    checkout.payment_method = payment_method;
    checkout.payment_code = payment_code;
    checkout.date_modified = Date.now();
    
    await checkout.save();
    
    res.json({
      message: 'Payment method added',
      checkout
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding payment method', error: err.message });
  }
};

// Complete checkout and create order
export const completeCheckout = async (req, res) => {
  try {
    const { checkout_id, comment } = req.body;
    
    if (!checkout_id) {
      return res.status(400).json({ message: 'Missing checkout ID' });
    }
    
    const checkout = await Checkout.findById(checkout_id);
    if (!checkout) {
      return res.status(404).json({ message: 'Checkout session not found' });
    }
    
    // Verify customer owns this checkout
    if (checkout.customer_id !== req.customer.id) {
      return res.status(403).json({ message: 'Not authorized to modify this checkout' });
    }
    
    // Validate required checkout fields
    if (!checkout.shipping_method || !checkout.payment_method) {
      return res.status(400).json({ 
        message: 'Incomplete checkout information',
        missing: [
          !checkout.shipping_method ? 'shipping_method' : null,
          !checkout.payment_method ? 'payment_method' : null
        ].filter(Boolean)
      });
    }
    
    // Get customer details
    const customer = await Customer.findOne({ customer_id: checkout.customer_id });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Get cart
    const cart = await Cart.findById(checkout.cart_id);
    if (!cart || !cart.items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    
    // Validate stock one more time
    for (const item of cart.items) {
      const product = await Product.findOne({ product_id: item.product_id });
      
      if (product.subtract && product.quantity < item.quantity) {
        return res.status(400).json({ 
          message: `Not enough stock for ${item.name}. Available: ${product.quantity}`
        });
      }
    }
    
    // Get latest order_id
    const lastOrder = await Order.findOne().sort({ order_id: -1 });
    const newOrderId = lastOrder ? lastOrder.order_id + 1 : 1;
    
    // Create order
    const order = new Order({
      order_id: newOrderId,
      customer_id: customer.customer_id,
      firstname: customer.firstname,
      lastname: customer.lastname,
      email: customer.email,
      telephone: customer.telephone,
      payment_method: checkout.payment_method,
      payment_code: checkout.payment_code,
      shipping_method: checkout.shipping_method,
      shipping_code: checkout.shipping_code,
      comment: comment || checkout.comment || '',
      total: checkout.total,
      order_status_id: 1, // Pending
      ip: checkout.ip_address,
      date_added: new Date(),
      date_modified: new Date()
    });
    
    await order.save();
    
    // Create order products
    for (const item of cart.items) {
      const orderProductId = await getNextOrderProductId();
      
      // Create new order product
      const orderProduct = new OrderProduct({
        order_product_id: orderProductId,
        order_id: newOrderId,
        product_id: item.product_id,
        name: item.name,
        model: item.model,
        quantity: item.quantity,
        price: item.final_price,
        total: item.final_price * item.quantity,
        tax: 0, // Set appropriately based on your tax calculations
        reward: 0, // Set if you use reward points
        options: item.options.map(opt => ({
          order_option_id: await getNextOrderOptionId(),
          product_option_id: opt.option_id,
          product_option_value_id: opt.option_value_id,
          name: opt.option_name,
          value: opt.option_value_name,
          type: 'select' // Set appropriately based on option type
        }))
      });
      
      await orderProduct.save();
      
      // Update product stock if needed
      if (product.subtract) {
        product.quantity -= item.quantity;
        await product.save();
      }
    }
    
    // Update checkout with order_id
    checkout.order_id = newOrderId;
    checkout.order_status_id = 1; // Pending
    checkout.date_modified = new Date();
    await checkout.save();
    
    // Clear cart
    cart.items = [];
    cart.updated_at = new Date();
    await cart.save();
    
    res.json({
      success: true,
      message: 'Order created successfully',
      order_id: newOrderId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error completing checkout', error: err.message });
  }
};

// Helper functions
async function getNextOrderProductId() {
  const lastProduct = await OrderProduct.findOne().sort({ order_product_id: -1 });
  return lastProduct ? lastProduct.order_product_id + 1 : 1;
}

async function getNextOrderOptionId() {
  // Assuming you have an OrderOption model or collection
  // If not, you might need to create a counter collection or use a different approach
  return Math.floor(Math.random() * 1000000); // Temporary solution
}