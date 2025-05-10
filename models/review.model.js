// models/review.model.js
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  review_id: { type: Number, unique: true },
  product_id: Number,
  customer_id: Number,
  author: String,
  text: String,
  rating: { type: Number, min: 1, max: 5 },
  status: { type: Boolean, default: false }, // Reviews need approval
  date_added: { type: Date, default: Date.now },
  date_modified: { type: Date, default: Date.now }
}, { collection: 'reviews' });

export default mongoose.model('Review', reviewSchema);