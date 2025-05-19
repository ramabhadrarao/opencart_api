// models/searchLog.model.js
import mongoose from 'mongoose';

const searchLogSchema = new mongoose.Schema({
  user_id: { type: Number, default: null }, // null means guest user
  user_type: { type: String, enum: ['customer', 'admin', 'guest'], default: 'guest' },
  session_id: String,
  ip_address: String,
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  query: { type: String, required: true },
  filters: mongoose.Schema.Types.Mixed,
  results_count: Number,
  category_id: Number,
  sort_option: String,
  page: Number,
  created_at: { type: Date, default: Date.now }
}, { collection: 'search_logs' });

// Create indexes for faster queries
searchLogSchema.index({ user_id: 1 });
searchLogSchema.index({ session_id: 1 });
searchLogSchema.index({ query: 'text' }); // Text index for search terms
searchLogSchema.index({ created_at: 1 });

// Define a TTL index to automatically remove old records (e.g., 90 days)
searchLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('SearchLog', searchLogSchema);