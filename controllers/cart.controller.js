// controllers/cart.controller.js
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';

// Get customer cart with product details
export const getCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    let cart = await Cart.findOne({ customer_id: customerId });
    
    if (!cart) {
      cart = new Cart({ customer_id: customerId, items: [] });
      await cart.save();
      return res.json({ cart, total: 0, items_count: 0 });
    }
    
    // Calculate totals
    let total = 0;
    let itemsCount = 0;
    
    for (const item of cart.items) {
      // Get up-to-date product info
      const product = await Product.findOne({ product_id: item.product_id, status: true });
      if (product) {
        // Update price in case it changed
        item.price = product.price;
        
        // Calculate option price adjustments
        let optionPriceAdjustment = 0;
        if (item.options && item.options.length > 0) {
          for (const itemOption of item.options) {
            // Find matching product option
            const productOption = product.options.find(po => po.option_id === itemOption.option_id);
            if (productOption) {
              const optionValue = productOption.values.find(ov => ov.option_value_id === itemOption.option_value_id);
              if (optionValue) {
                if (optionValue.price_prefix === '+') {
                  optionPriceAdjustment += parseFloat(optionValue.price);
                } else if (optionValue.price_prefix === '-') {
                  optionPriceAdjustment -= parseFloat(optionValue.price);
                }
              }
            }
          }
        }
        
        // Update item with current values
        item.final_price = parseFloat(product.price) + optionPriceAdjustment;
        item.quantity = Math.max(1, Math.min(item.quantity, product.quantity)); // Ensure quantity is valid
        item.subtotal = item.final_price * item.quantity;
        
        total += item.subtotal;
        itemsCount += item.quantity;
      }
    }
    
    // Save updated cart
    cart.updated_at = Date.now();
    await cart.save();
    
    res.json({
      cart,
      total: parseFloat(total.toFixed(2)),
      items_count: itemsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cart', error: err.message });
  }
};

// Add product to cart with options
export const addToCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { product_id, quantity = 1, options = [] } = req.body;
    
    if (!product_id || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid product or quantity' });
    }
    
    // Validate product exists and is available
    const product = await Product.findOne({ product_id, status: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found or unavailable' });
    }
    
    // Check stock if tracking inventory
    if (product.subtract && quantity > product.quantity) {
      return res.status(400).json({ 
        message: 'Requested quantity exceeds available stock',
        available: product.quantity
      });
    }
    
    // Validate options if provided
    const processedOptions = [];
    if (options.length > 0) {
      for (const option of options) {
        // Find product option
        const productOption = product.options.find(po => po.option_id === option.option_id);
        if (!productOption) {
          return res.status(400).json({ message: `Invalid option: ${option.option_id}` });
        }
        
        // Validate option value
        const optionValue = productOption.values.find(ov => ov.option_value_id === option.option_value_id);
        if (!optionValue) {
          return res.status(400).json({ message: `Invalid option value: ${option.option_value_id}` });
        }
        
        // Add to processed options
        processedOptions.push({
          option_id: option.option_id,
          option_name: productOption.name,
          option_value_id: option.option_value_id,
          option_value_name: optionValue.name,
          price_modifier: optionValue.price_prefix === '+' ? optionValue.price : (optionValue.price_prefix === '-' ? -optionValue.price : 0)
        });
      }
    }
    
    // Get main description
    const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
    
    // Find or create cart
    let cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      cart = new Cart({ customer_id: customerId, items: [] });
    }
    
    // Check if identical product+options already in cart
    const existingItemIndex = cart.items.findIndex(item => {
      if (item.product_id !== product_id) return false;
      
      // Check if options match
      if (item.options.length !== processedOptions.length) return false;
      
      // Compare each option
      for (const itemOption of item.options) {
        const matchingOption = processedOptions.find(o => 
          o.option_id === itemOption.option_id && 
          o.option_value_id === itemOption.option_value_id
        );
        if (!matchingOption) return false;
      }
      
      return true;
    });
    
    if (existingItemIndex > -1) {
      // Update quantity if already exists
      cart.items[existingItemIndex].quantity += quantity;
      
      // Ensure quantity doesn't exceed stock if tracking inventory
      if (product.subtract) {
        cart.items[existingItemIndex].quantity = Math.min(
          cart.items[existingItemIndex].quantity, 
          product.quantity
        );
      }
    } else {
      // Calculate final price with options
      let finalPrice = parseFloat(product.price);
      for (const option of processedOptions) {
        finalPrice += parseFloat(option.price_modifier || 0);
      }
      
      // Add new item
      cart.items.push({
        product_id,
        name: mainDesc.name || product.model,
        model: product.model,
        quantity,
        price: product.price,
        options: processedOptions,
        final_price: finalPrice,
        subtotal: finalPrice * quantity,
        image: product.image
      });
    }
    
    cart.updated_at = Date.now();
    await cart.save();
    
    // Calculate totals
    let total = 0;
    let itemsCount = 0;
    
    for (const item of cart.items) {
      total += item.subtotal;
      itemsCount += item.quantity;
    }
    
    res.json({
      message: 'Product added to cart',
      cart,
      total: parseFloat(total.toFixed(2)),
      items_count: itemsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding to cart', error: err.message });
  }
};

// Update cart item quantity
export const updateCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { item_id, quantity } = req.body;
    
    if (!item_id || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid item ID or quantity' });
    }
    
    // Find cart
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(item => item._id.toString() === item_id);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    // Get product to check stock
    const product = await Product.findOne({ 
      product_id: cart.items[itemIndex].product_id,
      status: true
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not available' });
    }
    
    // Check if quantity is valid
    if (product.subtract && quantity > product.quantity) {
      return res.status(400).json({ 
        message: 'Requested quantity exceeds available stock',
        available: product.quantity
      });
    }
    
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].subtotal = cart.items[itemIndex].final_price * quantity;
    
    // Update cart
    cart.updated_at = Date.now();
    await cart.save();
    
    // Calculate totals
    let total = 0;
    let itemsCount = 0;
    
    for (const item of cart.items) {
      total += item.subtotal;
      itemsCount += item.quantity;
    }
    
    res.json({
      message: 'Cart updated',
      cart,
      total: parseFloat(total.toFixed(2)),
      items_count: itemsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating cart', error: err.message });
  }
};

// Remove item from cart
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const itemId = req.params.item_id;
    
    // Find cart
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Find and remove item
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    
    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    // Update cart
    cart.updated_at = Date.now();
    await cart.save();
    
    // Calculate totals
    let total = 0;
    let itemsCount = 0;
    
    for (const item of cart.items) {
      total += item.subtotal;
      itemsCount += item.quantity;
    }
    
    res.json({
      message: 'Item removed from cart',
      cart,
      total: parseFloat(total.toFixed(2)),
      items_count: itemsCount
    });
  } catch (err) {
    res.status(500).json({ message: 'Error removing from cart', error: err.message });
  }
};

// Clear cart
export const clearCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Find cart
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    // Clear items
    cart.items = [];
    cart.updated_at = Date.now();
    await cart.save();
    
    res.json({
      message: 'Cart cleared',
      cart,
      total: 0,
      items_count: 0
    });
  } catch (err) {
    res.status(500).json({ message: 'Error clearing cart', error: err.message });
  }
};