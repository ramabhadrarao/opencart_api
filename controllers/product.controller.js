// controllers/product.controller.js
import Product from '../models/product.model.js';

// Get all products with pagination
export const getAllProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const category = req.query.category ? parseInt(req.query.category) : null;
    const search = req.query.search || '';
    
    // Build query
    const query = { status: true };
    
    // Add category filter if provided
    if (category) {
      query.categories = category;
    }
    
    // Add search filter if provided
    if (search) {
      query.$or = [
        { 'descriptions.name': { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Execute query with pagination
    const products = await Product.find(query)
      .sort({ date_added: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Product.countDocuments(query);
    
    // Format products for response
    const formattedProducts = products.map(product => {
      // Get main description (assuming language_id 1 is default)
      const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || '',
        model: product.model,
        price: product.price,
        image: product.image,
        quantity: product.quantity,
        status: product.status
      };
    });
    
    res.json({
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching products', error: err.message });
  }
};

// Get single product with all details
export const getProductById = async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    
    const product = await Product.findOne({ product_id: productId, status: true });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get main description
    const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
    
    // Get related products
    let relatedProducts = [];
    if (product.related_products && product.related_products.length > 0) {
      relatedProducts = await Product.find({
        product_id: { $in: product.related_products },
        status: true
      }).select('product_id model price image descriptions');
      
      // Format related products
      relatedProducts = relatedProducts.map(rp => {
        const rpDesc = rp.descriptions.find(d => d.language_id === 1) || rp.descriptions[0] || {};
        return {
          product_id: rp.product_id,
          name: rpDesc.name || '',
          model: rp.model,
          price: rp.price,
          image: rp.image
        };
      });
    }
    
    // Format response
    const response = {
      product_id: product.product_id,
      name: mainDesc.name || '',
      description: mainDesc.description || '',
      meta_title: mainDesc.meta_title || '',
      meta_description: mainDesc.meta_description || '',
      meta_keyword: mainDesc.meta_keyword || '',
      model: product.model,
      sku: product.sku,
      price: product.price,
      quantity: product.quantity,
      minimum: product.minimum,
      stock_status_id: product.stock_status_id,
      shipping: product.shipping,
      image: product.image,
      additional_images: product.additional_images,
      manufacturer_id: product.manufacturer_id,
      categories: product.categories,
      attributes: product.attributes,
      options: product.options,
      discounts: product.discounts,
      downloads: product.downloads,
      related_products: relatedProducts,
      status: product.status,
      date_added: product.date_added
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching product', error: err.message });
  }
};

// Get purchased products for a customer
export const getPurchasedProducts = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Find all orders for this customer
    const orderProducts = await OrderProduct.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: 'order_id',
          foreignField: 'order_id',
          as: 'order'
        }
      },
      {
        $match: {
          'order.customer_id': customerId,
          'order.order_status_id': { $in: [3, 5] } // Shipped or Complete status
        }
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product_id',
          foreignField: 'product_id',
          as: 'product'
        }
      },
      {
        $unwind: '$product'
      },
      {
        $project: {
          product_id: 1,
          name: 1,
          model: 1,
          price: 1,
          quantity: 1,
          order_id: 1,
          download_links: 1,
          product_image: '$product.image',
          date_purchased: '$order.date_added'
        }
      }
    ]);
    
    res.json({
      count: orderProducts.length,
      products: orderProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching purchased products', error: err.message });
  }
};