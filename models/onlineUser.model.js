// models/onlineUser.model.js
import mongoose from 'mongoose';

const onlineUserSchema = new mongoose.Schema({
  user_id: Number, // Will be null for guests
  user_type: { type: String, enum: ['customer', 'admin', 'guest'], default: 'guest' },
  username: String, // Will be null for guests
  email: String, // Will be null for guests
  session_id: { type: String, required: true, unique: true },
  ip_address: String,
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  user_agent: String,
  browser: String,
  operating_system: String,
  device_type: String,
  current_url: String,
  referrer: String,
  entry_page: String,
  page_views: { type: Number, default: 1 },
  last_activity: { type: Date, default: Date.now }
}, { collection: 'online_users' });

// Create indexes for faster queries
onlineUserSchema.index({ user_id: 1 });
onlineUserSchema.index({ session_id: 1 }, { unique: true });
onlineUserSchema.index({ last_activity: 1 });

// Define a TTL index for online status (e.g., 15 minutes)
// This will automatically remove users who haven't been active in the last 15 minutes
onlineUserSchema.index({ last_activity: 1 }, { expireAfterSeconds: 15 * 60 });

export default mongoose.model('OnlineUser', onlineUserSchema);