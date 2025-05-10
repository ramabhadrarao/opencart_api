// controllers/search.controller.js
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';

export const searchProducts = async (req, res) => {
  try {
    const {
      query = '',          // Main search term
      category = null,     // Category ID
      price_min = 0,       // Minimum price
      price_max = null,    // Maximum price
      sort = 'relevance',  // Sort order (relevance, price_asc, price_desc, date_added)
      page = 1,            // Page number
      limit = 10           // Results per page
    } = req.query;
    
    // Skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build the search query
    const searchQuery = { status: true };
    
    // Search in name and description
    if (query) {
      searchQuery.$or = [
        { 'descriptions.name': { $regex: query, $options: 'i' } },
        { 'descriptions.description': { $regex: query, $options: 'i' } },
        { model: { $regex: query, $options: 'i' } },
        { sku: { $regex: query, $options: 'i' } }
      ];
    }
    
    // Add category filter if specified
    if (category) {
      // If we need to search in subcategories too
      const categoryIds = [parseInt(category)];
      
      // Get all subcategories (optional)
      const subcategories = await Category.find({ parent_id: parseInt(category) });
      if (subcategories.length > 0) {
        categoryIds.push(...subcategories.map(cat => cat.category_id));
      }
      
      searchQuery.categories = { $in: categoryIds };
    }
    
    // Add price range filters
    if (price_min > 0 || price_max) {
      searchQuery.price = {};
      
      if (price_min > 0) {
        searchQuery.price.$gte = parseFloat(price_min);
      }
      
      if (price_max) {
        searchQuery.price.$lte = parseFloat(price_max);
      }
    }
    
    // Determine sort order
    let sortOrder = {};
    switch (sort) {
      case 'price_asc':
        sortOrder = { price: 1 };
        break;
      case 'price_desc':
        sortOrder = { price: -1 };
        break;
      case 'date_added':
        sortOrder = { date_added: -1 };
        break;
      case 'name_asc':
        sortOrder = { 'descriptions.name': 1 };
        break;
      case 'name_desc':
        sortOrder = { 'descriptions.name': -1 };
        break;
      case 'relevance':
      default:
        // For relevance sorting, we could implement a more complex scoring system
        // For now, we'll use date_added as a proxy for relevance
        sortOrder = { date_added: -1 };
    }
    
    // Execute query with pagination
    const products = await Product.find(searchQuery)
      .sort(sortOrder)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Product.countDocuments(searchQuery);
    
    // Format products for response
    const formattedProducts = products.map(product => {
      const mainDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      
      return {
        product_id: product.product_id,
        name: mainDesc.name || '',
        description: mainDesc.description 
          ? mainDesc.description.substring(0, 200) + (mainDesc.description.length > 200 ? '...' : '') 
          : '',
        model: product.model,
        price: product.price,
        image: product.image,
        quantity: product.quantity,
        status: product.status,
        date_added: product.date_added
      };
    });
    
    res.json({
      products: formattedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        query,
        category,
        price_min,
        price_max,
        sort
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error searching products', error: err.message });
  }
};

// Get search filters (categories, price ranges, etc.)
export const getSearchFilters = async (req, res) => {
  try {
    // Get all active categories
    const categories = await Category.find({ status: true }).sort({ sort_order: 1 });
    
    // Format categories for response
    const formattedCategories = categories.map(category => {
      const mainDesc = category.descriptions.find(d => d.language_id === 1) || category.descriptions[0] || {};
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        parent_id: category.parent_id
      };
    });
    
    // Get price ranges
    const priceSummary = await Product.aggregate([
      { $match: { status: true } },
      { 
        $group: {
          _id: null,
          min_price: { $min: '$price' },
          max_price: { $max: '$price' },
          avg_price: { $avg: '$price' }
        }
      }
    ]);
    
    const priceRange = priceSummary.length > 0 
      ? { 
          min: Math.floor(priceSummary[0].min_price), 
          max: Math.ceil(priceSummary[0].max_price),
          avg: Math.round(priceSummary[0].avg_price)
        }
      : { min: 0, max: 1000, avg: 500 };
    
    // Available sort options
    const sortOptions = [
      { id: 'relevance', name: 'Relevance' },
      { id: 'price_asc', name: 'Price (Low to High)' },
      { id: 'price_desc', name: 'Price (High to Low)' },
      { id: 'date_added', name: 'Newest First' },
      { id: 'name_asc', name: 'Name (A-Z)' },
      { id: 'name_desc', name: 'Name (Z-A)' }
    ];
    
    res.json({
      categories: formattedCategories,
      price_range: priceRange,
      sort_options: sortOptions
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching search filters', error: err.message });
  }
};