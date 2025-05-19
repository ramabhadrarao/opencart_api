// models/userActivity.model.js
import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
  ip: String,
  country: String,
  region: String,
  city: String,
  latitude: Number,
  longitude: Number,
  timezone: String,
  isp: String
});

const userActivitySchema = new mongoose.Schema({
  user_id: { type: Number, default: null }, // null means guest user
  user_type: { type: String, enum: ['customer', 'admin', 'guest'], default: 'guest' },
  session_id: String,
  ip_address: String,
  location: locationSchema,
  user_agent: String,
  referrer: String,
  activity_type: { 
    type: String, 
    enum: ['login', 'logout', 'view_product', 'search', 'add_to_cart', 'checkout', 'order', 'register', 'other'],
    required: true 
  },
  activity_data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  active: { type: Boolean, default: true },
  last_activity: { type: Date, default: Date.now },
  created_at: { type: Date, default: Date.now }
}, { collection: 'user_activities' });

// Create indexes for faster queries
userActivitySchema.index({ user_id: 1 });
userActivitySchema.index({ session_id: 1 });
userActivitySchema.index({ ip_address: 1 });
userActivitySchema.index({ activity_type: 1 });
userActivitySchema.index({ last_activity: 1 });
userActivitySchema.index({ active: 1 });

// Define a TTL index to automatically remove old records (e.g., 30 days)
userActivitySchema.index({ created_at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model('UserActivity', userActivitySchema);





