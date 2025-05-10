// controllers/wishlist.controller.js
import Wishlist from '../models/wishlist.model.js';
import Product from '../models/product.model.js';

// Get customer wishlist
export const getWishlist = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ customer_id: customerId });
    if (!wishlist) {
      wishlist = new Wishlist({ customer_id: customerId, products: [] });
      await wishlist.save();
    }
    
    // Get product details
    const productIds = wishlist.products.map(item => item.product_id);
    const products = await Product.find({ 
      product_id: { $in: productIds },
      status: true
    });
    
    // Format response
    const formattedProducts = products.map(product => {
      const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      const wishlistItem = wishlist.products.find(item => item.product_id === product.product_id);
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || '',
        model: product.model,
        price: product.price,
        image: product.image,
        date_added: wishlistItem.date_added
      };
    });
    
    res.json({
      count: formattedProducts.length,
      products: formattedProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching wishlist', error: err.message });
  }
};

// Add product to wishlist
export const addToWishlist = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { product_id } = req.body;
    
    if (!product_id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    
    // Validate product exists
    const product = await Product.findOne({ product_id, status: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ customer_id: customerId });
    if (!wishlist) {
      wishlist = new Wishlist({ customer_id: customerId, products: [] });
    }
    
    // Check if product already in wishlist
    const exists = wishlist.products.some(item => item.product_id === parseInt(product_id));
    if (exists) {
      return res.status(409).json({ message: 'Product already in wishlist' });
    }
    
    // Add to wishlist
    wishlist.products.push({
      product_id: parseInt(product_id),
      date_added: new Date()
    });
    
    await wishlist.save();
    
    res.json({
      message: 'Product added to wishlist',
      wishlist
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding to wishlist', error: err.message });
  }
};

// Remove from wishlist
export const removeFromWishlist = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const productId = parseInt(req.params.product_id);
    
    // Find wishlist
    const wishlist = await Wishlist.findOne({ customer_id: customerId });
    if (!wishlist) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }
    
    // Remove product
    wishlist.products = wishlist.products.filter(item => item.product_id !== productId);
    
    await wishlist.save();
    
    res.json({
      message: 'Product removed from wishlist',
      wishlist
    });
  } catch (err) {
    res.status(500).json({ message: 'Error removing from wishlist', error: err.message });
  }
};