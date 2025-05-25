// controllers/cart.controller.js - OPTIMIZED VERSION
import Cart from '../models/cart.model.js';
import Product from '../models/product.model.js';

// Get customer cart with optimized product fetching
export const getCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    let cart = await Cart.findOne({ customer_id: customerId }).lean();
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.json({ 
        cart: { items: [] }, 
        totals: { subtotal: 0, total: 0 },
        items_count: 0 
      });
    }
    
    // OPTIMIZED: Batch fetch all products at once (fixes N+1 query issue)
    const productIds = cart.items.map(item => item.product_id);
    const products = await Product.find({ 
      product_id: { $in: productIds }, 
      status: true 
    }).lean();
    
    // Create product lookup map for O(1) access
    const productMap = new Map(products.map(p => [p.product_id, p]));
    
    // Calculate totals and update items with current product data
    let subtotal = 0;
    let itemsCount = 0;
    const validItems = [];
    const unavailableItems = [];
    
    for (const item of cart.items) {
      const product = productMap.get(item.product_id);
      
      if (!product) {
        unavailableItems.push(item);
        continue;
      }
      
      // Get main product description
      const mainDesc = product.descriptions?.find(d => d.language_id === 1) || 
                       product.descriptions?.[0] || {};
      
      // Calculate option price adjustments
      let optionPriceAdjustment = 0;
      const validOptions = [];
      
      if (item.options && item.options.length > 0) {
        for (const itemOption of item.options) {
          const productOption = product.options?.find(po => po.option_id === itemOption.option_id);
          if (productOption) {
            const optionValue = productOption.values?.find(ov => 
              ov.option_value_id === itemOption.option_value_id
            );
            if (optionValue) {
              if (optionValue.price_prefix === '+') {
                optionPriceAdjustment += parseFloat(optionValue.price || 0);
              } else if (optionValue.price_prefix === '-') {
                optionPriceAdjustment -= parseFloat(optionValue.price || 0);
              }
              validOptions.push({
                ...itemOption,
                price_modifier: optionValue.price || 0,
                price_prefix: optionValue.price_prefix || '+'
              });
            }
          }
        }
      }
      
      // Check stock availability
      const maxQuantity = product.subtract ? product.quantity : 999999;
      const validQuantity = Math.max(1, Math.min(item.quantity, maxQuantity));
      
      // Calculate final prices
      const basePrice = parseFloat(product.price || 0);
      const finalPrice = basePrice + optionPriceAdjustment;
      const itemSubtotal = finalPrice * validQuantity;
      
      const validItem = {
        _id: item._id,
        product_id: item.product_id,
        name: mainDesc.name || product.model || 'Unknown Product',
        model: product.model || '',
        image: product.image || '',
        quantity: validQuantity,
        max_quantity: maxQuantity,
        base_price: basePrice,
        final_price: finalPrice,
        subtotal: itemSubtotal,
        options: validOptions,
        in_stock: !product.subtract || product.quantity >= validQuantity,
        stock_quantity: product.quantity || 0,
        // Include product details for display
        product_details: {
          description: mainDesc.description?.substring(0, 200) || '',
          weight: product.weight || 0,
          dimensions: {
            length: product.length || 0,
            width: product.width || 0,
            height: product.height || 0
          }
        }
      };
      
      validItems.push(validItem);
      subtotal += itemSubtotal;
      itemsCount += validQuantity;
    }
    
    // Calculate totals (you can add tax, shipping, discounts here)
    const tax = subtotal * 0.1; // Example 10% tax
    const shipping = subtotal > 100 ? 0 : 10; // Free shipping over $100
    const total = subtotal + tax + shipping;
    
    const response = {
      cart: {
        customer_id: customerId,
        items: validItems,
        updated_at: cart.updated_at
      },
      totals: {
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        shipping: parseFloat(shipping.toFixed(2)),
        total: parseFloat(total.toFixed(2))
      },
      items_count: itemsCount,
      summary: {
        total_items: validItems.length,
        unavailable_items: unavailableItems.length,
        has_out_of_stock: validItems.some(item => !item.in_stock)
      }
    };
    
    // If there were unavailable items, mention them
    if (unavailableItems.length > 0) {
      response.warnings = [
        `${unavailableItems.length} item(s) in your cart are no longer available`
      ];
    }
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cart', error: err.message });
  }
};

// Add product to cart with enhanced validation
export const addToCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { product_id, quantity = 1, options = [] } = req.body;
    
    // Validation
    if (!product_id || quantity <= 0) {
      return res.status(400).json({ message: 'Invalid product ID or quantity' });
    }
    
    if (quantity > 10) {
      return res.status(400).json({ message: 'Maximum quantity per item is 10' });
    }
    
    // Validate product exists and is available
    const product = await Product.findOne({ product_id, status: true }).lean();
    if (!product) {
      return res.status(404).json({ message: 'Product not found or unavailable' });
    }
    
    // Check stock if tracking inventory
    if (product.subtract && quantity > product.quantity) {
      return res.status(400).json({ 
        message: 'Requested quantity exceeds available stock',
        available: product.quantity,
        requested: quantity
      });
    }
    
    // Validate and process options
    const processedOptions = [];
    let optionPriceAdjustment = 0;
    
    if (options.length > 0) {
      for (const option of options) {
        const productOption = product.options?.find(po => po.option_id === option.option_id);
        if (!productOption) {
          return res.status(400).json({ 
            message: `Invalid option: ${option.option_id}`,
            available_options: product.options?.map(po => ({
              option_id: po.option_id,
              name: po.name
            })) || []
          });
        }
        
        const optionValue = productOption.values?.find(ov => 
          ov.option_value_id === option.option_value_id
        );
        if (!optionValue) {
          return res.status(400).json({ 
            message: `Invalid option value: ${option.option_value_id}`,
            available_values: productOption.values?.map(ov => ({
              option_value_id: ov.option_value_id,
              name: ov.name
            })) || []
          });
        }
        
        // Calculate price modifier
        if (optionValue.price_prefix === '+') {
          optionPriceAdjustment += parseFloat(optionValue.price || 0);
        } else if (optionValue.price_prefix === '-') {
          optionPriceAdjustment -= parseFloat(optionValue.price || 0);
        }
        
        processedOptions.push({
          option_id: option.option_id,
          option_name: productOption.name,
          option_value_id: option.option_value_id,
          option_value_name: optionValue.name,
          price_modifier: parseFloat(optionValue.price || 0),
          price_prefix: optionValue.price_prefix || '+'
        });
      }
    }
    
    // Get main description
    const mainDesc = product.descriptions?.find(d => d.language_id === 1) || 
                     product.descriptions?.[0] || {};
    
    // Find or create cart
    let cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      cart = new Cart({ customer_id: customerId, items: [] });
    }
    
    // Check if identical product+options already in cart
    const existingItemIndex = cart.items.findIndex(item => {
      if (item.product_id !== product_id) return false;
      
      if (item.options.length !== processedOptions.length) return false;
      
      return processedOptions.every(newOption => 
        item.options.some(existingOption => 
          existingOption.option_id === newOption.option_id && 
          existingOption.option_value_id === newOption.option_value_id
        )
      );
    });
    
    const finalPrice = parseFloat(product.price) + optionPriceAdjustment;
    
    if (existingItemIndex > -1) {
      // Update existing item
      const newQuantity = cart.items[existingItemIndex].quantity + quantity;
      
      // Check stock for new total quantity
      if (product.subtract && newQuantity > product.quantity) {
        return res.status(400).json({ 
          message: 'Cannot add more items. Total quantity would exceed available stock',
          current_in_cart: cart.items[existingItemIndex].quantity,
          trying_to_add: quantity,
          available: product.quantity
        });
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].final_price = finalPrice;
      cart.items[existingItemIndex].subtotal = finalPrice * newQuantity;
    } else {
      // Add new item
      cart.items.push({
        product_id,
        name: mainDesc.name || product.model || 'Unknown Product',
        model: product.model || '',
        image: product.image || '',
        quantity,
        price: product.price,
        options: processedOptions,
        final_price: finalPrice,
        subtotal: finalPrice * quantity
      });
    }
    
    cart.updated_at = new Date();
    await cart.save();
    
    // Return updated cart summary
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    res.json({
      message: 'Product added to cart successfully',
      added_item: {
        product_id,
        name: mainDesc.name || product.model,
        quantity,
        final_price: finalPrice
      },
      cart_summary: {
        items_count: itemsCount,
        total: parseFloat(cartTotal.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding to cart', error: err.message });
  }
};

// Update cart item quantity with enhanced validation
export const updateCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const { item_id, quantity } = req.body;
    
    if (!item_id || quantity < 0) {
      return res.status(400).json({ message: 'Invalid item ID or quantity' });
    }
    
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === item_id);
    if (itemIndex === -1) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    // If quantity is 0, remove the item
    if (quantity === 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      // Get product to check stock
      const product = await Product.findOne({ 
        product_id: cart.items[itemIndex].product_id,
        status: true
      }).lean();
      
      if (!product) {
        return res.status(404).json({ message: 'Product not available' });
      }
      
      // Check stock if tracking inventory
      if (product.subtract && quantity > product.quantity) {
        return res.status(400).json({ 
          message: 'Requested quantity exceeds available stock',
          available: product.quantity,
          requested: quantity
        });
      }
      
      // Update item
      cart.items[itemIndex].quantity = quantity;
      cart.items[itemIndex].subtotal = cart.items[itemIndex].final_price * quantity;
    }
    
    cart.updated_at = new Date();
    await cart.save();
    
    // Calculate new totals
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    res.json({
      message: quantity === 0 ? 'Item removed from cart' : 'Cart updated successfully',
      cart_summary: {
        items_count: itemsCount,
        total: parseFloat(cartTotal.toFixed(2))
      }
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
    
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const initialLength = cart.items.length;
    cart.items = cart.items.filter(item => item._id.toString() !== itemId);
    
    if (cart.items.length === initialLength) {
      return res.status(404).json({ message: 'Item not found in cart' });
    }
    
    cart.updated_at = new Date();
    await cart.save();
    
    // Calculate new totals
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const cartTotal = cart.items.reduce((sum, item) => sum + item.subtotal, 0);
    
    res.json({
      message: 'Item removed from cart successfully',
      cart_summary: {
        items_count: itemsCount,
        total: parseFloat(cartTotal.toFixed(2))
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error removing from cart', error: err.message });
  }
};

// Clear entire cart
export const clearCart = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    const cart = await Cart.findOne({ customer_id: customerId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    cart.items = [];
    cart.updated_at = new Date();
    await cart.save();
    
    res.json({
      message: 'Cart cleared successfully',
      cart_summary: {
        items_count: 0,
        total: 0
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error clearing cart', error: err.message });
  }
};

// Get cart summary (lightweight version)
export const getCartSummary = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    const cart = await Cart.findOne({ customer_id: customerId }).lean();
    
    if (!cart || !cart.items.length) {
      return res.json({
        items_count: 0,
        total: 0,
        has_items: false
      });
    }
    
    const itemsCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    
    res.json({
      items_count: itemsCount,
      total: parseFloat(total.toFixed(2)),
      has_items: itemsCount > 0,
      last_updated: cart.updated_at
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching cart summary', error: err.message });
  }
};

export default {
  getCart,
  addToCart,
  updateCart,
  removeFromCart,
  clearCart,
  getCartSummary
};