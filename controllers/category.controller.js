// controllers/category.controller.js - ENHANCED WITH TREE OPERATIONS
import Category from '../models/category.model.js';
import Product from '../models/product.model.js';
import { getNextCategoryId } from '../utils/idGenerator.js';
// Get all categories in flat list
export const getAllCategories = async (req, res) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const filters = includeInactive ? {} : { status: true };
    
    const categories = await Category.find(filters)
      .sort({ sort_order: 1, category_id: 1 })
      .lean();
    
    const formattedCategories = categories.map(category => {
      const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                       category.descriptions?.[0] || {};
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        parent_id: category.parent_id,
        image: category.image,
        sort_order: category.sort_order,
        status: category.status,
        path: category.path || []
      };
    });
    
    res.json({
      categories: formattedCategories,
      total: formattedCategories.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching categories', error: err.message });
  }
};

// Get category tree structure
export const getCategoryTree = async (req, res) => {
  try {
    const maxDepth = parseInt(req.query.max_depth) || 10;
    const includeProductCounts = req.query.include_counts === 'true';
    
    const categories = await Category.find({ status: true })
      .sort({ sort_order: 1, category_id: 1 })
      .lean();
    
    // Get product counts if requested
    let productCounts = new Map();
    if (includeProductCounts) {
      const counts = await Product.aggregate([
        { $match: { status: true } },
        { $unwind: '$categories' },
        { $group: { _id: '$categories', count: { $sum: 1 } } }
      ]);
      productCounts = new Map(counts.map(c => [c._id, c.count]));
    }
    
    // Build tree structure
    const tree = buildCategoryTree(categories, 0, 0, maxDepth, productCounts);
    
    res.json({
      tree,
      total_categories: categories.length,
      max_depth: maxDepth
    });
  } catch (err) {
    res.status(500).json({ message: 'Error building category tree', error: err.message });
  }
};

// Helper function to build category tree recursively
const buildCategoryTree = (categories, parentId = 0, currentDepth = 0, maxDepth = 10, productCounts = new Map()) => {
  if (currentDepth >= maxDepth) return [];
  
  return categories
    .filter(cat => cat.parent_id === parentId)
    .map(category => {
      const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                       category.descriptions?.[0] || {};
      
      const children = buildCategoryTree(categories, category.category_id, currentDepth + 1, maxDepth, productCounts);
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        description: mainDesc.description || '',
        image: category.image,
        sort_order: category.sort_order,
        parent_id: category.parent_id,
        level: currentDepth,
        has_children: children.length > 0,
        children: children,
        product_count: productCounts.get(category.category_id) || 0,
        path: category.path || []
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
};

// Get category by ID with enhanced details
export const getCategoryById = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortBy = req.query.sort || 'sort_order';
    const sortOrder = req.query.order === 'desc' ? -1 : 1;
    
    // Get the category
    const category = await Category.findOne({ 
      category_id: categoryId, 
      status: true 
    }).lean();
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                     category.descriptions?.[0] || {};
    
    // Get parent category if exists
    let parentCategory = null;
    if (category.parent_id > 0) {
      const parent = await Category.findOne({ 
        category_id: category.parent_id, 
        status: true 
      }).lean();
      if (parent) {
        const parentDesc = parent.descriptions?.find(d => d.language_id === 1) || 
                          parent.descriptions?.[0] || {};
        parentCategory = {
          category_id: parent.category_id,
          name: parentDesc.name || '',
          image: parent.image
        };
      }
    }
    
    // Get child categories
    const childCategories = await Category.find({ 
      parent_id: categoryId, 
      status: true 
    }).sort({ sort_order: 1 }).lean();
    
    const formattedChildren = childCategories.map(child => {
      const childDesc = child.descriptions?.find(d => d.language_id === 1) || 
                        child.descriptions?.[0] || {};
      return {
        category_id: child.category_id,
        name: childDesc.name || '',
        image: child.image,
        sort_order: child.sort_order
      };
    });
    
    // Build sort object for products
    const sortObj = {};
    if (sortBy === 'name') {
      sortObj['descriptions.name'] = sortOrder;
    } else if (sortBy === 'price') {
      sortObj.price = sortOrder;
    } else if (sortBy === 'date_added') {
      sortObj.date_added = sortOrder;
    } else {
      sortObj.sort_order = sortOrder;
    }
    
    // Get products in this category and subcategories
    const allCategoryIds = [categoryId, ...childCategories.map(c => c.category_id)];
    
    const products = await Product.find({ 
      categories: { $in: allCategoryIds },
      status: true
    })
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .lean();
    
    const totalProducts = await Product.countDocuments({ 
      categories: { $in: allCategoryIds },
      status: true
    });
    
    // Format products with enhanced details
    const formattedProducts = products.map(product => {
      const productDesc = product.descriptions?.find(d => d.language_id === 1) || 
                          product.descriptions?.[0] || {};
      
      // Calculate if product has special price
      let specialPrice = null;
      if (product.special_prices && product.special_prices.length > 0) {
        const activeSpecial = product.special_prices.find(special => {
          const now = new Date();
          const startDate = special.date_start ? new Date(special.date_start) : new Date(0);
          const endDate = special.date_end ? new Date(special.date_end) : new Date('2099-12-31');
          return now >= startDate && now <= endDate;
        });
        if (activeSpecial) {
          specialPrice = activeSpecial.price;
        }
      }
      
      return {
        product_id: product.product_id,
        name: productDesc.name || '',
        description: productDesc.description?.substring(0, 200) || '',
        model: product.model,
        price: product.price,
        special_price: specialPrice,
        image: product.image,
        quantity: product.quantity,
        in_stock: !product.subtract || product.quantity > 0,
        manufacturer_id: product.manufacturer_id,
        rating: 0, // Calculate from reviews if needed
        reviews_count: 0, // Calculate from reviews if needed
        date_added: product.date_added
      };
    });
    
    // Get breadcrumb path using category path
    let breadcrumbs = [];
    if (category.path && category.path.length > 0) {
      const pathCategories = await Category.find({
        category_id: { $in: category.path },
        status: true
      }).lean();
      
      breadcrumbs = category.path.map(pathId => {
        const pathCat = pathCategories.find(c => c.category_id === pathId);
        if (pathCat) {
          const pathDesc = pathCat.descriptions?.find(d => d.language_id === 1) || 
                          pathCat.descriptions?.[0] || {};
          return {
            category_id: pathCat.category_id,
            name: pathDesc.name || ''
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    // Add current category to breadcrumbs
    breadcrumbs.push({
      category_id: category.category_id,
      name: mainDesc.name || ''
    });
    
    res.json({
      category: {
        category_id: category.category_id,
        name: mainDesc.name || '',
        description: mainDesc.description || '',
        meta_title: mainDesc.meta_title || '',
        meta_description: mainDesc.meta_description || '',
        image: category.image,
        parent_id: category.parent_id,
        sort_order: category.sort_order,
        path: category.path || []
      },
      parent_category: parentCategory,
      children: formattedChildren,
      breadcrumbs: breadcrumbs,
      products: formattedProducts,
      pagination: {
        page,
        limit,
        total: totalProducts,
        pages: Math.ceil(totalProducts / limit)
      },
      filters: {
        sort_options: [
          { value: 'sort_order', label: 'Default' },
          { value: 'name', label: 'Name' },
          { value: 'price', label: 'Price' },
          { value: 'date_added', label: 'Latest' }
        ]
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching category', error: err.message });
  }
};

// Get category path/breadcrumbs
export const getCategoryPath = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.id);
    
    const category = await Category.findOne({ 
      category_id: categoryId, 
      status: true 
    }).lean();
    
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    let path = [];
    
    if (category.path && category.path.length > 0) {
      const pathCategories = await Category.find({
        category_id: { $in: category.path },
        status: true
      }).lean();
      
      // Maintain order from path array
      path = category.path.map(pathId => {
        const pathCat = pathCategories.find(c => c.category_id === pathId);
        if (pathCat) {
          const pathDesc = pathCat.descriptions?.find(d => d.language_id === 1) || 
                          pathCat.descriptions?.[0] || {};
          return {
            category_id: pathCat.category_id,
            name: pathDesc.name || '',
            url: `/categories/${pathCat.category_id}`
          };
        }
        return null;
      }).filter(Boolean);
    }
    
    // Add current category
    const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                     category.descriptions?.[0] || {};
    path.push({
      category_id: category.category_id,
      name: mainDesc.name || '',
      url: `/categories/${category.category_id}`,
      current: true
    });
    
    res.json({
      category_id: categoryId,
      path: path,
      depth: path.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching category path', error: err.message });
  }
};

// Get top-level categories (roots)
export const getTopCategories = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const categories = await Category.find({ 
      parent_id: 0, 
      status: true 
    })
    .sort({ sort_order: 1 })
    .limit(limit)
    .lean();
    
    // Get product counts for each top category
    const categoryIds = categories.map(c => c.category_id);
    const productCounts = await Product.aggregate([
      { $match: { status: true, categories: { $in: categoryIds } } },
      { $unwind: '$categories' },
      { $match: { categories: { $in: categoryIds } } },
      { $group: { _id: '$categories', count: { $sum: 1 } } }
    ]);
    
    const countMap = new Map(productCounts.map(pc => [pc._id, pc.count]));
    
    const formattedCategories = categories.map(category => {
      const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                       category.descriptions?.[0] || {};
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        description: mainDesc.description || '',
        image: category.image,
        sort_order: category.sort_order,
        product_count: countMap.get(category.category_id) || 0
      };
    });
    
    res.json({
      categories: formattedCategories,
      total: categories.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching top categories', error: err.message });
  }
};

// Search categories
export const searchCategories = async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }
    
    const categories = await Category.find({
      status: true,
      'descriptions.name': { $regex: query, $options: 'i' }
    })
    .limit(limit)
    .lean();
    
    const formattedCategories = categories.map(category => {
      const mainDesc = category.descriptions?.find(d => d.language_id === 1) || 
                       category.descriptions?.[0] || {};
      
      return {
        category_id: category.category_id,
        name: mainDesc.name || '',
        parent_id: category.parent_id,
        image: category.image,
        path: category.path || []
      };
    });
    
    res.json({
      query,
      categories: formattedCategories,
      total: formattedCategories.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error searching categories', error: err.message });
  }
};
// Create category (Admin only)
export const createCategory = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const { 
      parent_id = 0, 
      image, 
      top = false, 
      column = 1, 
      sort_order = 0, 
      status = true,
      descriptions,
      stores = [0]
    } = req.body;
    
    // Validate required fields
    if (!descriptions || !descriptions.length) {
      return res.status(400).json({ message: 'At least one description is required' });
    }
    
    // Check if main description exists
    const mainDesc = descriptions.find(d => d.language_id === 1);
    if (!mainDesc || !mainDesc.name) {
      return res.status(400).json({ message: 'Main description with name is required' });
    }
    
    // ✅ USE ID GENERATOR
    const categoryId = await getNextCategoryId();
    
    const category = new Category({
      category_id: categoryId,
      parent_id,
      image: image || '',
      top,
      column,
      sort_order,
      status,
      date_added: new Date(),
      date_modified: new Date(),
      descriptions,
      stores,
      path: parent_id > 0 ? await buildCategoryPath(parent_id, categoryId) : [categoryId]
    });
    
    await category.save();
    
    auditLogService.logCreate(req, 'category', category.toObject());
    
    res.status(201).json({
      message: 'Category created successfully',
      category_id: categoryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating category', error: err.message });
  }
};

// Update category
export const updateCategory = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const categoryId = parseInt(req.params.id);
    const updateData = req.body;
    
    const category = await Category.findOne({ category_id: categoryId });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    const originalCategory = category.toObject();
    
    // Update fields
    Object.keys(updateData).forEach(key => {
      if (key !== 'category_id') {
        category[key] = updateData[key];
      }
    });
    
    category.date_modified = new Date();
    await category.save();
    
    auditLogService.logUpdate(req, 'category', originalCategory, category.toObject());
    
    res.json({
      message: 'Category updated successfully',
      category_id: categoryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating category', error: err.message });
  }
};

// Delete category
export const deleteCategory = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const categoryId = parseInt(req.params.id);
    
    // Check if category has children
    const childCategories = await Category.countDocuments({ parent_id: categoryId });
    if (childCategories > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete category with child categories' 
      });
    }
    
    // Check if category has products
    const productCount = await Product.countDocuments({ categories: categoryId });
    if (productCount > 0) {
      return res.status(400).json({ 
        message: `Cannot delete category with ${productCount} products` 
      });
    }
    
    const category = await Category.findOne({ category_id: categoryId });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    
    await Category.deleteOne({ category_id: categoryId });
    
    auditLogService.logDelete(req, 'category', category.toObject());
    
    res.json({
      message: 'Category deleted successfully',
      category_id: categoryId
    });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting category', error: err.message });
  }
};

// Helper function to build category path
async function buildCategoryPath(parentId, currentId) {
  const parent = await Category.findOne({ category_id: parentId });
  if (!parent) return [currentId];
  
  return [...(parent.path || []), currentId];
}
export default {
  getAllCategories,
  getCategoryTree,
  getCategoryById,
  getCategoryPath,
  getTopCategories,
  searchCategories,
  createCategory,
  updateCategory,
  deleteCategory
};