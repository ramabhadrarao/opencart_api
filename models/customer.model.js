import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  address_id: { type: Number },
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
  customer_id: { type: Number, required: true }, // REMOVED unique: true
  customer_group_id: { type: Number, default: 1 },
  store_id: { type: Number, default: 0 },
  language_id: { type: Number, default: 1 },
  firstname: { type: String },
  lastname: { type: String },
  email: { type: String },
  telephone: { type: String },
  fax: String,
  password: { type: String },
  salt: String,
  cart: mongoose.Schema.Types.Mixed,
  wishlist: [Number],
  newsletter: { type: Boolean, default: false },
  address_id: { type: Number, default: 0 },
  custom_field: mongoose.Schema.Types.Mixed,
  ip: String,
  status: { type: Boolean, default: true },
  safe: { type: Boolean, default: false },
  token: String,
  code: String,
  date_added: { type: Date, default: Date.now },
  
  // For password reset
  reset_token: String,
  reset_token_expiry: Date,
  
  // Addresses (embedded)
  addresses: [addressSchema],
  
  // Additional tracking fields
  last_login: Date,
  last_ip: String,
  total_logins: { type: Number, default: 0 },
  total_orders: { type: Number, default: 0 },
  
  // Migration verification field
  original_mysql_id: Number,
  migration_notes: [String]
}, { 
  collection: 'customers',
  timestamps: true
});

// Create indexes ONLY with schema.index()
customerSchema.index({ customer_id: 1 }, { unique: true });
customerSchema.index({ email: 1 }, { sparse: true });
customerSchema.index({ status: 1 });
customerSchema.index({ date_added: -1 });

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