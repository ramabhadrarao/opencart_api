// models/customer.model.js
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  address_id: { type: Number, unique: true },
  firstname: String,
  lastname: String,
  company: String,
  address_1: String,
  address_2: String,
  city: String,
  postcode: String,
  country_id: Number,
  zone_id: Number,
  custom_field: mongoose.Schema.Types.Mixed
});

const customerSchema = new mongoose.Schema({
  customer_id: { type: Number, unique: true, required: true, index: true },
  customer_group_id: { type: Number, default: 1 },
  store_id: { type: Number, default: 0 },
  language_id: { type: Number, default: 1 },
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  telephone: { type: String, required: true },
  fax: String,
  password: { type: String, required: true },
  salt: String,
  cart: mongoose.Schema.Types.Mixed,
  wishlist: [Number],
  newsletter: { type: Boolean, default: false },
  address_id: { type: Number, default: 0 },
  custom_field: mongoose.Schema.Types.Mixed,
  ip: String,
  status: { type: Boolean, default: true, index: true },
  safe: { type: Boolean, default: false },
  token: String,
  code: String,
  date_added: { type: Date, default: Date.now, index: true },
  
  // For password reset
  reset_token: String,
  reset_token_expiry: Date,
  
  // Addresses (embedded for better performance)
  addresses: [addressSchema],
  
  // Additional tracking fields
  last_login: Date,
  last_ip: String,
  total_logins: { type: Number, default: 0 },
  total_orders: { type: Number, default: 0 }
}, { 
  collection: 'customers',
  timestamps: true
});

// Create indexes
customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ status: 1 });
customerSchema.index({ date_added: -1 });
customerSchema.index({ 'addresses.country_id': 1 });
customerSchema.index({ 'addresses.zone_id': 1 });

// Add full text search
customerSchema.index({
  firstname: 'text',
  lastname: 'text',
  email: 'text',
  telephone: 'text'
});

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
  return `${this.firstname} ${this.lastname}`;
});

export default mongoose.model('Customer', customerSchema);