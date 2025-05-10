// controllers/review.controller.js
import Review from '../models/review.model.js';
import Product from '../models/product.model.js';
import Customer from '../models/customer.model.js';

// Get reviews for a product
export const getProductReviews = async (req, res) => {
  try {
    const productId = parseInt(req.params.product_id);
    
    // Validate product exists
    const product = await Product.findOne({ product_id: productId, status: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get approved reviews
    const reviews = await Review.find({ 
      product_id: productId,
      status: true
    }).sort({ date_added: -1 });
    
    res.json({
      count: reviews.length,
      reviews
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching reviews', error: err.message });
  }
};

// Add a review
export const addReview = async (req, res) => {
  try {
    const { product_id, rating, text } = req.body;
    const customerId = req.customer.id;
    
    if (!product_id || !rating || !text) {
      return res.status(400).json({ message: 'Missing required fields' });
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }
    
    // Validate product exists
    const product = await Product.findOne({ product_id, status: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Get customer info
    const customer = await Customer.findOne({ customer_id: customerId });
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }
    
    // Check if customer already reviewed this product
    const existingReview = await Review.findOne({ 
      product_id: parseInt(product_id),
      customer_id: customerId
    });
    
    if (existingReview) {
      return res.status(409).json({ message: 'You have already reviewed this product' });
    }
    
    // Get next review_id
    const lastReview = await Review.findOne().sort({ review_id: -1 });
    const newReviewId = lastReview ? lastReview.review_id + 1 : 1;
    
    // Create new review
    const newReview = new Review({
      review_id: newReviewId,
      product_id: parseInt(product_id),
      customer_id: customerId,
      author: `${customer.firstname} ${customer.lastname}`,
      text,
      rating: parseInt(rating),
      status: false, // Needs approval
      date_added: new Date(),
      date_modified: new Date()
    });
    
    await newReview.save();
    
    res.status(201).json({
      message: 'Review added successfully. Pending approval.',
      review: newReview
    });
  } catch (err) {
    res.status(500).json({ message: 'Error adding review', error: err.message });
  }
};