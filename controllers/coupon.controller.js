// controllers/coupon.controller.js - UPDATED
import Coupon from '../models/coupon.model.js';
import { getNextCouponId } from '../utils/idGenerator.js'; // ✅ ADDED

// Get all coupons (Admin only)
export const getAllCoupons = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const coupons = await Coupon.find();
    
    res.json({
      count: coupons.length,
      coupons: coupons.map(coupon => ({
        coupon_id: coupon.coupon_id,
        name: coupon.name,
        code: coupon.code,
        type: coupon.type,
        discount: coupon.discount,
        total: coupon.total,
        date_start: coupon.date_start,
        date_end: coupon.date_end,
        uses_total: coupon.uses_total,
        uses_customer: coupon.uses_customer,
        status: coupon.status
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching coupons', error: err.message });
  }
};

// Get a coupon by code (Customer or Public)
export const getCouponByCode = async (req, res) => {
  try {
    const code = req.params.code;
    
    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(),
      status: true,
      $or: [
        { date_end: { $gte: new Date() } },
        { date_end: null }
      ]
    });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found or expired' });
    }
    
    // For security, return limited information if not admin
    if (!req.admin) {
      return res.json({
        coupon_id: coupon.coupon_id,
        name: coupon.name,
        code: coupon.code,
        type: coupon.type,
        discount: coupon.discount,
        shipping: coupon.shipping,
        date_end: coupon.date_end
      });
    }
    
    // Return full details for admin
    res.json(coupon);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching coupon', error: err.message });
  }
};

// Create a new coupon (Admin only) - ✅ UPDATED WITH ID GENERATOR
export const createCoupon = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const {
      name,
      code,
      type,
      discount,
      logged,
      shipping,
      total,
      date_start,
      date_end,
      uses_total,
      uses_customer,
      status,
      products,
      categories
    } = req.body;
    
    // Validate required fields
    if (!name || !code || !discount) {
      return res.status(400).json({ message: 'Name, code, and discount are required' });
    }
    
    // Check if coupon code already exists
    const existingCoupon = await Coupon.findOne({ code: code.toUpperCase() });
    if (existingCoupon) {
      return res.status(409).json({ message: 'Coupon code already exists' });
    }
    
    // ✅ USE ID GENERATOR FOR COUPON
    const newCouponId = await getNextCouponId();
    
    // Create new coupon
    const newCoupon = new Coupon({
      coupon_id: newCouponId,
      name,
      code: code.toUpperCase(),
      type: type || 'P',
      discount,
      logged: logged || false,
      shipping: shipping || false,
      total: total || 0,
      date_start: date_start || new Date(),
      date_end: date_end || null,
      uses_total: uses_total || 1,
      uses_customer: uses_customer || 1,
      status: status !== undefined ? status : true,
      products: products || [],
      categories: categories || [],
      date_added: new Date()
    });
    
    await newCoupon.save();
    
    res.status(201).json({
      message: 'Coupon created successfully',
      coupon: {
        coupon_id: newCoupon.coupon_id,
        name: newCoupon.name,
        code: newCoupon.code
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating coupon', error: err.message });
  }
};

// Update an existing coupon (Admin only)
export const updateCoupon = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const couponId = parseInt(req.params.id);
    const updateFields = req.body;
    
    // Find coupon
    const coupon = await Coupon.findOne({ coupon_id: couponId });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    // Check if code is being changed and already exists
    if (updateFields.code && updateFields.code !== coupon.code) {
      const existingCoupon = await Coupon.findOne({ 
        code: updateFields.code.toUpperCase(),
        coupon_id: { $ne: couponId }
      });
      
      if (existingCoupon) {
        return res.status(409).json({ message: 'Coupon code already exists' });
      }
      
      // Ensure code is uppercase
      updateFields.code = updateFields.code.toUpperCase();
    }
    
    // Update coupon fields
    Object.keys(updateFields).forEach(key => {
      coupon[key] = updateFields[key];
    });
    
    await coupon.save();
    
    res.json({
      message: 'Coupon updated successfully',
      coupon: {
        coupon_id: coupon.coupon_id,
        name: coupon.name,
        code: coupon.code,
        status: coupon.status
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating coupon', error: err.message });
  }
};

// Delete a coupon (Admin only)
export const deleteCoupon = async (req, res) => {
  try {
    // Ensure user has admin privileges
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const couponId = parseInt(req.params.id);
    
    // Find and delete coupon
    const coupon = await Coupon.findOneAndDelete({ coupon_id: couponId });
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    
    res.json({
      message: 'Coupon deleted successfully',
      coupon_id: couponId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting coupon', error: err.message });
  }
};

// Apply coupon to checkout (Customer only)
export const applyCoupon = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.customer) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const { checkout_id, coupon_code } = req.body;
    
    if (!checkout_id || !coupon_code) {
      return res.status(400).json({ message: 'Checkout ID and coupon code are required' });
    }
    
    // Find the checkout
    const checkout = await Checkout.findById(checkout_id);
    if (!checkout) {
      return res.status(404).json({ message: 'Checkout session not found' });
    }
    
    // Verify customer owns this checkout
    if (checkout.customer_id !== req.customer.id) {
      return res.status(403).json({ message: 'Not authorized to modify this checkout' });
    }
    
    // Find the coupon
    const coupon = await Coupon.findOne({ 
      code: coupon_code.toUpperCase(),
      status: true,
      $or: [
        { date_end: { $gte: new Date() } },
        { date_end: null }
      ]
    });
    
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found or expired' });
    }
    
    // Check if coupon requires logged in
    if (coupon.logged && !req.customer) {
      return res.status(403).json({ message: 'You must be logged in to use this coupon' });
    }
    
    // Check minimum order amount
    if (coupon.total > 0 && checkout.total < coupon.total) {
      return res.status(400).json({ 
        message: `Minimum order amount not reached`,
        required: coupon.total,
        current: checkout.total
      });
    }
    
    // Check usage limits
    if (coupon.uses_total > 0) {
      const totalUses = coupon.history ? coupon.history.length : 0;
      if (totalUses >= coupon.uses_total) {
        return res.status(400).json({ message: 'Coupon usage limit reached' });
      }
    }
    
    if (coupon.uses_customer > 0) {
      const customerUses = coupon.history 
        ? coupon.history.filter(h => h.customer_id === req.customer.id).length 
        : 0;
        
      if (customerUses >= coupon.uses_customer) {
        return res.status(400).json({ message: 'You have reached the usage limit for this coupon' });
      }
    }
    
    // Check product and category restrictions
    if (coupon.products.length > 0 || coupon.categories.length > 0) {
      // Get cart to check products
      const cart = await Cart.findById(checkout.cart_id);
      
      let validItems = 0;
      for (const item of cart.items) {
        // Check if product is directly included
        if (coupon.products.includes(item.product_id)) {
          validItems++;
          continue;
        }
        
        // Check if product belongs to an included category
        if (coupon.categories.length > 0) {
          const product = await Product.findOne({ product_id: item.product_id });
          if (product && product.categories.some(c => coupon.categories.includes(c))) {
            validItems++;
          }
        }
      }
      
      if (validItems === 0) {
        return res.status(400).json({ 
          message: 'Coupon is not valid for any products in your cart' 
        });
      }
    }
    
    // Calculate discount
    let discount = 0;
    if (coupon.type === 'P') { // Percentage
      discount = checkout.total * (coupon.discount / 100);
    } else { // Fixed amount
      discount = Math.min(coupon.discount, checkout.total);
    }
    
    // Update checkout with coupon
    checkout.coupon_id = coupon.coupon_id;
    checkout.coupon_code = coupon.code;
    checkout.coupon_discount = parseFloat(discount.toFixed(2));
    checkout.date_modified = new Date();
    
    await checkout.save();
    
    res.json({
      message: 'Coupon applied successfully',
      discount: checkout.coupon_discount,
      new_total: parseFloat((checkout.total - checkout.coupon_discount).toFixed(2))
    });
  } catch (err) {
    res.status(500).json({ message: 'Error applying coupon', error: err.message });
  }
};