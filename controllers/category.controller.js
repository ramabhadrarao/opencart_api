// controllers/category.controller.js
import Category from '../models/category.model.js';
import Product from '../models/product.model.js';

// Get all categories
export const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: true }).sort({ sort_order: 1 });
    
    // Format the response
    const formattedCategories = categories.map(category => {
      // Get main description (assuming language_id 1 is default)
      const mainDesc = category.descriptions.find(d => d.language_id === 1) || category.descriptions[0] || {};
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        parent_id: category.parent_id,
        image: category.image,
        sort_order: category.sort_order
      };
    });
    
    res.json(formattedCategories);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching categories', error: err.message });
  }
};

// Get category by ID with products
export const getCategoryById = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    // Get the category
    const category = await Category.findOne({ category_id: categoryId, status: true });
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    // Get the main description
    const mainDesc = category.descriptions.find(d => d.language_id === 1) || category.descriptions[0] || {};
    
    // Get child categories
    const childCategories = await Category.find({ parent_id: categoryId, status: true })
      .sort({ sort_order: 1 });
    
    const formattedChildCategories = childCategories.map(child => {
      const childDesc = child.descriptions.find(d => d.language_id === 1) || child.descriptions[0] || {};
      return {
        category_id: child.category_id,
        name: childDesc.name || '',
        image: child.image
      };
    });
    
    // Get products in this category
    const products = await Product.find({ 
      categories: categoryId,
      status: true
    })
    .sort({ sort_order: 1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Product.countDocuments({ 
      categories: categoryId,
      status: true
    });
    
    // Format products
    const formattedProducts = products.map(product => {
      const productDesc = product.descriptions.find(d => d.language_id === 1) || product.descriptions[0] || {};
      return {
        product_id: product.product_id,
        name: productDesc.name || '',
        model: product.model,
        price: product.price,
        image: product.image,
        quantity: product.quantity
      };
    });
    
    res.json({
      category_id: category.category_id,
      name: mainDesc.name || '',
      description: mainDesc.description || '',
      meta_title: mainDesc.meta_title || '',
      meta_description: mainDesc.meta_description || '',
      image: category.image,
      parent_id: category.parent_id,
      children: formattedChildCategories,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching category', error: err.message });
  }
};