// controllers/search.controller.js - ENHANCED WITH AGGREGATION
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';
import Manufacturer from '../models/manufacturer.model.js';
import SearchLog from '../models/searchLog.model.js';

// Enhanced search with MongoDB aggregation pipeline
export const searchProducts = async (req, res) => {
  try {
    const {
      query = '',
      category = null,
      manufacturer = null,
      price_min = 0,
      price_max = null,
      sort = 'relevance',
      page = 1,
      limit = 20,
      in_stock = null,
      has_image = null,
      on_sale = null
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build aggregation pipeline
    const pipeline = [];
    
    // Match stage - basic filtering
    const matchStage = {
      status: true
    };
    
    // Text search
    if (query && query.trim()) {
      matchStage.$or = [
        { 'descriptions.name': { $regex: query.trim(), $options: 'i' } },
        { 'descriptions.description': { $regex: query.trim(), $options: 'i' } },
        { 'descriptions.meta_keyword': { $regex: query.trim(), $options: 'i' } },
        { model: { $regex: query.trim(), $options: 'i' } },
        { sku: { $regex: query.trim(), $options: 'i' } }
      ];
    }
    
    // Category filter (including subcategories)
    if (category) {
      const categoryId = parseInt(category);
      // Get all subcategories
      const subcategories = await Category.find({ 
        $or: [
          { category_id: categoryId },
          { path: categoryId }
        ],
        status: true 
      }).lean();
      
      const categoryIds = subcategories.map(c => c.category_id);
      matchStage.categories = { $in: categoryIds };
    }
    
    // Manufacturer filter
    if (manufacturer) {
      matchStage.manufacturer_id = parseInt(manufacturer);
    }
    
    // Price range filter
    if (price_min > 0 || price_max) {
      matchStage.price = {};
      if (price_min > 0) matchStage.price.$gte = parseFloat(price_min);
      if (price_max) matchStage.price.$lte = parseFloat(price_max);
    }
    
    // Stock filter
    if (in_stock === 'true') {
      matchStage.$or = [
        { subtract: false },
        { $and: [{ subtract: true }, { quantity: { $gt: 0 } }] }
      ];
    } else if (in_stock === 'false') {
      matchStage.$and = [
        { subtract: true },
        { quantity: 0 }
      ];
    }
    
    // Has image filter
    if (has_image === 'true') {
      matchStage.image = { $ne: null, $ne: '' };
    }
    
    pipeline.push({ $match: matchStage });
    
    // Add special price calculation
    pipeline.push({
      $addFields: {
        current_price: {
          $let: {
            vars: {
              activeSpecial: {
                $filter: {
                  input: '$special_prices',
                  cond: {
                    $and: [
                      { $lte: [{ $ifNull: ['$$this.date_start', new Date(0)] }, new Date()] },
                      { $gte: [{ $ifNull: ['$$this.date_end', new Date('2099-12-31')] }, new Date()] }
                    ]
                  }
                }
              }
            },
            in: {
              $cond: {
                if: { $gt: [{ $size: '$$activeSpecial' }, 0] },
                then: { $arrayElemAt: ['$$activeSpecial.price', 0] },
                else: '$price'
              }
            }
          }
        },
        has_special: {
          $gt: [
            {
              $size: {
                $filter: {
                  input: '$special_prices',
                  cond: {
                    $and: [
                      { $lte: [{ $ifNull: ['$$this.date_start', new Date(0)] }, new Date()] },
                      { $gte: [{ $ifNull: ['$$this.date_end', new Date('2099-12-31')] }, new Date()] }
                    ]
                  }
                }
              }
            },
            0
          ]
        }
      }
    });
    
    // Filter by sale status if requested
    if (on_sale === 'true') {
      pipeline.push({
        $match: { has_special: true }
      });
    }
    
    // Add category and manufacturer details
    pipeline.push({
      $lookup: {
        from: 'categories',
        localField: 'categories',
        foreignField: 'category_id',
        as: 'category_details'
      }
    });
    
    pipeline.push({
      $lookup: {
        from: 'manufacturers',
        localField: 'manufacturer_id',
        foreignField: 'manufacturer_id',
        as: 'manufacturer_details'
      }
    });
    
    // Add search relevance score
    if (query && query.trim()) {
      pipeline.push({
        $addFields: {
          relevance_score: {
            $add: [
              // Name match gets highest score
              {
                $cond: [
                  { $regexMatch: { input: { $arrayElemAt: ['$descriptions.name', 0] }, regex: query.trim(), options: 'i' } },
                  10,
                  0
                ]
              },
              // Model match gets medium score
              {
                $cond: [
                  { $regexMatch: { input: '$model', regex: query.trim(), options: 'i' } },
                  5,
                  0
                ]
              },
              // Description match gets lower score
              {
                $cond: [
                  { $regexMatch: { input: { $arrayElemAt: ['$descriptions.description', 0] }, regex: query.trim(), options: 'i' } },
                  1,
                  0
                ]
              }
            ]
          }
        }
      });
    }
    
    // Get total count before pagination
    const countPipeline = [...pipeline, { $count: 'total' }];
    
    // Add sorting
    let sortStage = {};
    switch (sort) {
      case 'price_asc':
        sortStage = { current_price: 1, product_id: 1 };
        break;
      case 'price_desc':
        sortStage = { current_price: -1, product_id: 1 };
        break;
      case 'name_asc':
        sortStage = { 'descriptions.name': 1, product_id: 1 };
        break;
      case 'name_desc':
        sortStage = { 'descriptions.name': -1, product_id: 1 };
        break;
      case 'date_added':
        sortStage = { date_added: -1, product_id: 1 };
        break;
      case 'popularity':
        sortStage = { viewed: -1, product_id: 1 };
        break;
      case 'relevance':
      default:
        if (query && query.trim()) {
          sortStage = { relevance_score: -1, viewed: -1, product_id: 1 };
        } else {
          sortStage = { sort_order: 1, product_id: 1 };
        }
    }
    
    pipeline.push({ $sort: sortStage });
    
    // Add pagination
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });
    
    // Project final fields
    pipeline.push({
      $project: {
        product_id: 1,
        name: { $arrayElemAt: ['$descriptions.name', 0] },
        description: { 
          $substr: [
            { $ifNull: [{ $arrayElemAt: ['$descriptions.description', 0] }, ''] },
            0,
            200
          ]
        },
        model: 1,
        price: 1,
        current_price: 1,
        has_special: 1,
        image: 1,
        quantity: 1,
        in_stock: {
          $cond: [
            '$subtract',
            { $gt: ['$quantity', 0] },
            true
          ]
        },
        manufacturer_name: { $arrayElemAt: ['$manufacturer_details.name', 0] },
        category_names: '$category_details.descriptions.name',
        date_added: 1,
        viewed: 1,
        relevance_score: { $ifNull: ['$relevance_score', 0] }
      }
    });
    
    // Execute aggregation
    const [products, countResult] = await Promise.all([
      Product.aggregate(pipeline),
      Product.aggregate(countPipeline)
    ]);
    
    const total = countResult[0]?.total || 0;
    
    // Log search if query is provided
    if (query && query.trim()) {
      try {
        const searchLog = new SearchLog({
          user_id: req.customer?.id || null,
          user_type: req.customer ? 'customer' : 'guest',
          session_id: req.cookies?.session_id || null,
          ip_address: req.ip,
          query: query.trim(),
          filters: {
            category,
            manufacturer,
            price_min,
            price_max,
            sort,
            in_stock,
            has_image,
            on_sale
          },
          results_count: total,
          category_id: category ? parseInt(category) : null,
          sort_option: sort,
          page: parseInt(page)
        });
        
        await searchLog.save();
      } catch (logError) {
        console.error('Error logging search:', logError);
      }
    }
    
    const response = {
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        query: query.trim(),
        category,
        manufacturer,
        price_min,
        price_max,
        sort,
        in_stock,
        has_image,
        on_sale
      },
      summary: {
        total_results: total,
        has_results: total > 0,
        search_time: Date.now() // You could calculate actual search time
      }
    };
    
    res.json(response);
  } catch (err) {
    res.status(500).json({ message: 'Error searching products', error: err.message });
  }
};

// Get search suggestions
export const getSearchSuggestions = async (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }
    
    // Get product name suggestions
    const productSuggestions = await Product.aggregate([
      {
        $match: {
          status: true,
          'descriptions.name': { $regex: query, $options: 'i' }
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ['$descriptions.name', 0] },
          type: { $literal: 'product' },
          product_id: 1,
          image: 1
        }
      },
      { $limit: limit }
    ]);
    
    // Get category suggestions
    const categorySuggestions = await Category.aggregate([
      {
        $match: {
          status: true,
          'descriptions.name': { $regex: query, $options: 'i' }
        }
      },
      {
        $project: {
          name: { $arrayElemAt: ['$descriptions.name', 0] },
          type: { $literal: 'category' },
          category_id: 1
        }
      },
      { $limit: 5 }
    ]);
    
    // Get manufacturer suggestions
    const manufacturerSuggestions = await Manufacturer.aggregate([
      {
        $match: {
          name: { $regex: query, $options: 'i' }
        }
      },
      {
        $project: {
          name: 1,
          type: { $literal: 'manufacturer' },
          manufacturer_id: 1
        }
      },
      { $limit: 3 }
    ]);
    
    const suggestions = [
      ...productSuggestions,
      ...categorySuggestions,
      ...manufacturerSuggestions
    ].slice(0, limit);
    
    res.json({
      query,
      suggestions,
      total: suggestions.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Error getting search suggestions', error: err.message });
  }
};

// Get search filters with faceted counts
export const getSearchFilters = async (req, res) => {
  try {
    const { query = '', category = null } = req.query;
    
    // Build base match for faceted search
    const baseMatch = { status: true };
    
    if (query && query.trim()) {
      baseMatch.$or = [
        { 'descriptions.name': { $regex: query.trim(), $options: 'i' } },
        { 'descriptions.description': { $regex: query.trim(), $options: 'i' } },
        { model: { $regex: query.trim(), $options: 'i' } }
      ];
    }
    
    if (category) {
      const categoryId = parseInt(category);
      const subcategories = await Category.find({ 
        $or: [
          { category_id: categoryId },
          { path: categoryId }
        ],
        status: true 
      }).lean();
      
      const categoryIds = subcategories.map(c => c.category_id);
      baseMatch.categories = { $in: categoryIds };
    }
    
    // Get faceted data using aggregation
    const facetPipeline = [
      { $match: baseMatch },
      {
        $facet: {
          // Categories facet
          categories: [
            { $unwind: '$categories' },
            {
              $lookup: {
                from: 'categories',
                localField: 'categories',
                foreignField: 'category_id',
                as: 'category_info'
              }
            },
            { $unwind: '$category_info' },
            { $match: { 'category_info.status': true } },
            {
              $group: {
                _id: '$categories',
                name: { $first: { $arrayElemAt: ['$category_info.descriptions.name', 0] } },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 20 }
          ],
          
          // Manufacturers facet
          manufacturers: [
            { $match: { manufacturer_id: { $ne: null, $gt: 0 } } },
            {
              $lookup: {
                from: 'manufacturers',
                localField: 'manufacturer_id',
                foreignField: 'manufacturer_id',
                as: 'manufacturer_info'
              }
            },
            { $unwind: '$manufacturer_info' },
            {
              $group: {
                _id: '$manufacturer_id',
                name: { $first: '$manufacturer_info.name' },
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 15 }
          ],
          
          // Price ranges facet
          price_ranges: [
            {
              $bucket: {
                groupBy: '$price',
                boundaries: [0, 25, 50, 100, 200, 500, 1000, 9999999],
                default: 'Other',
                output: {
                  count: { $sum: 1 },
                  min_price: { $min: '$price' },
                  max_price: { $max: '$price' }
                }
              }
            }
          ],
          
          // Stock status facet
          stock_status: [
            {
              $group: {
                _id: {
                  $cond: [
                    { $or: [{ $eq: ['$subtract', false] }, { $gt: ['$quantity', 0] }] },
                    'in_stock',
                    'out_of_stock'
                  ]
                },
                count: { $sum: 1 }
              }
            }
          ],
          
          // Special offers facet
          special_offers: [
            {
              $addFields: {
                has_special: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: '$special_prices',
                          cond: {
                            $and: [
                              { $lte: [{ $ifNull: ['$this.date_start', new Date(0)] }, new Date()] },
                              { $gte: [{ $ifNull: ['$this.date_end', new Date('2099-12-31')] }, new Date()] }
                            ]
                          }
                        }
                      }
                    },
                    0
                  ]
                }
              }
            },
            {
              $group: {
                _id: '$has_special',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];
    
    const [facetResults] = await Product.aggregate(facetPipeline);
    
    // Get overall price range
    const priceStats = await Product.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          min_price: { $min: '$price' },
          max_price: { $max: '$price' },
          avg_price: { $avg: '$price' }
        }
      }
    ]);
    
    const priceRange = priceStats[0] || { min_price: 0, max_price: 1000, avg_price: 500 };
    
    // Format price ranges
    const priceRangeLabels = {
      0: 'Under $25',
      25: '$25 - $50',
      50: '$50 - $100',
      100: '$100 - $200',
      200: '$200 - $500',
      500: '$500 - $1000',
      1000: 'Over $1000'
    };
    
    const formattedPriceRanges = facetResults.price_ranges.map(range => ({
      id: range._id,
      label: priceRangeLabels[range._id] || `${range.min_price} - ${range.max_price}`,
      count: range.count,
      min: range.min_price,
      max: range.max_price
    }));
    
    // Available sort options
    const sortOptions = [
      { id: 'relevance', name: 'Relevance' },
      { id: 'popularity', name: 'Popularity' },
      { id: 'price_asc', name: 'Price (Low to High)' },
      { id: 'price_desc', name: 'Price (High to Low)' },
      { id: 'date_added', name: 'Newest First' },
      { id: 'name_asc', name: 'Name (A-Z)' },
      { id: 'name_desc', name: 'Name (Z-A)' }
    ];
    
    res.json({
      filters: {
        categories: facetResults.categories.map(cat => ({
          category_id: cat._id,
          name: cat.name,
          count: cat.count
        })),
        manufacturers: facetResults.manufacturers.map(mfg => ({
          manufacturer_id: mfg._id,
          name: mfg.name,
          count: mfg.count
        })),
        price_ranges: formattedPriceRanges,
        stock_status: facetResults.stock_status.map(status => ({
          status: status._id,
          label: status._id === 'in_stock' ? 'In Stock' : 'Out of Stock',
          count: status.count
        })),
        special_offers: facetResults.special_offers.map(offer => ({
          has_special: offer._id,
          label: offer._id ? 'On Sale' : 'Regular Price',
          count: offer.count
        }))
      },
      price_range: {
        min: Math.floor(priceRange.min_price),
        max: Math.ceil(priceRange.max_price),
        avg: Math.round(priceRange.avg_price)
      },
      sort_options: sortOptions
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching search filters', error: err.message });
  }
};

// Get popular searches with analytics
export const getPopularSearches = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const limit = parseInt(req.query.limit) || 10;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const popularSearches = await SearchLog.aggregate([
      { 
        $match: { 
          created_at: { $gte: startDate },
          query: { $ne: '', $ne: null }
        } 
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$query' } } },
          count: { $sum: 1 },
          avg_results: { $avg: '$results_count' },
          last_searched: { $max: '$created_at' },
          unique_users: { $addToSet: '$user_id' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          query: '$_id',
          search_count: '$count',
          avg_results: { $round: ['$avg_results', 0] },
          last_searched: '$last_searched',
          unique_users: { $size: '$unique_users' }
        }
      }
    ]);
    
    // Get trending searches (searches that are increasing)
    const trendingSearches = await SearchLog.aggregate([
      {
        $match: {
          created_at: { $gte: startDate },
          query: { $ne: '', $ne: null }
        }
      },
      {
        $group: {
          _id: {
            query: { $toLower: { $trim: { input: '$query' } } },
            week: { $week: '$created_at' }
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.query',
          weeks: { $push: { week: '$_id.week', count: '$count' } },
          total: { $sum: '$count' }
        }
      },
      {
        $match: {
          $expr: { $gte: [{ $size: '$weeks' }, 2] }
        }
      },
      {
        $addFields: {
          trend_score: {
            $let: {
              vars: {
                sorted: { $sortArray: { input: '$weeks', sortBy: { week: 1 } } }
              },
              in: {
                $divide: [
                  { $arrayElemAt: ['$sorted.count', -1] },
                  { $arrayElemAt: ['$sorted.count', 0] }
                ]
              }
            }
          }
        }
      },
      { $match: { trend_score: { $gt: 1.5 } } },
      { $sort: { trend_score: -1 } },
      { $limit: 5 },
      {
        $project: {
          _id: 0,
          query: '$_id',
          total_searches: '$total',
          trend_score: { $round: ['$trend_score', 2] }
        }
      }
    ]);
    
    res.json({
      period: `${days} days`,
      popular_searches: popularSearches,
      trending_searches: trendingSearches,
      generated_at: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching popular searches', error: err.message });
  }
};

// Get search analytics for admin
export const getSearchAnalytics = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Search volume over time
    const searchVolume = await SearchLog.aggregate([
      { $match: { created_at: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
          total_searches: { $sum: 1 },
          unique_queries: { $addToSet: { $toLower: '$query' } },
          avg_results: { $avg: '$results_count' }
        }
      },
      {
        $project: {
          _id: 0,
          date: '$_id',
          total_searches: 1,
          unique_queries: { $size: '$unique_queries' },
          avg_results: { $round: ['$avg_results', 1] }
        }
      },
      { $sort: { date: 1 } }
    ]);
    
    // Zero result searches
    const zeroResultSearches = await SearchLog.aggregate([
      { 
        $match: { 
          created_at: { $gte: startDate },
          results_count: 0,
          query: { $ne: '', $ne: null }
        } 
      },
      {
        $group: {
          _id: { $toLower: { $trim: { input: '$query' } } },
          count: { $sum: 1 },
          last_searched: { $max: '$created_at' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          query: '$_id',
          count: 1,
          last_searched: 1
        }
      }
    ]);
    
    // Search performance by category
    const categoryPerformance = await SearchLog.aggregate([
      { 
        $match: { 
          created_at: { $gte: startDate },
          category_id: { $ne: null }
        }
      },
      {
        $lookup: {
          from: 'categories',
          localField: 'category_id',
          foreignField: 'category_id',
          as: 'category'
        }
      },
      { $unwind: '$category' },
      {
        $group: {
          _id: '$category_id',
          category_name: { $first: { $arrayElemAt: ['$category.descriptions.name', 0] } },
          search_count: { $sum: 1 },
          avg_results: { $avg: '$results_count' }
        }
      },
      { $sort: { search_count: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({
      period: `${days} days`,
      search_volume,
      zero_result_searches,
      category_performance,
      summary: {
        total_searches: searchVolume.reduce((sum, day) => sum + day.total_searches, 0),
        zero_result_count: zeroResultSearches.reduce((sum, search) => sum + search.count, 0)
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching search analytics', error: err.message });
  }
};

export default {
  searchProducts,
  getSearchSuggestions,
  getSearchFilters,
  getPopularSearches,
  getSearchAnalytics
};