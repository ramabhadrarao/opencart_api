// models/wishlist.model.js
import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema({
  customer_id: { type: Number, unique: true },
  products: [{
    product_id: Number,
    date_added: { type: Date, default: Date.now }
  }]
}, { collection: 'wishlists' });

export default mongoose.model('Wishlist', wishlistSchema);