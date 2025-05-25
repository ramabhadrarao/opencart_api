import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema({
  order_product_id: { type: Number, unique: true },
  product_id: { type: Number, required: true },
  name: { type: String, required: true },
  model: String,
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true },
  total: { type: Number, required: true },
  tax: Number,
  reward: Number,
  
  // Options for this order item
  options: [{
    order_option_id: Number,
    product_option_id: Number,
    product_option_value_id: Number,
    name: String,
    value: String,
    type: String
  }]
});

const orderSchema = new mongoose.Schema({
  order_id: { type: Number, unique: true, required: true },
  invoice_no: { type: Number, default: 0 },
  invoice_prefix: String,
  store_id: { type: Number, default: 0 },
  store_name: String,
  store_url: String,
  customer_id: { type: Number, default: 0 },
  customer_group_id: Number,
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  email: { type: String, required: true },
  telephone: String,
  fax: String,
  custom_field: mongoose.Schema.Types.Mixed,
  
  // Payment details
  payment_firstname: String,
  payment_lastname: String,
  payment_company: String,
  payment_address_1: String,
  payment_address_2: String,
  payment_city: String,
  payment_postcode: String,
  payment_country: String,
  payment_country_id: Number,
  payment_zone: String,
  payment_zone_id: Number,
  payment_address_format: String,
  payment_custom_field: mongoose.Schema.Types.Mixed,
  payment_method: String,
  payment_code: String,
  
  // Shipping details
  shipping_firstname: String,
  shipping_lastname: String,
  shipping_company: String,
  shipping_address_1: String,
  shipping_address_2: String,
  shipping_city: String,
  shipping_postcode: String,
  shipping_country: String,
  shipping_country_id: Number,
  shipping_zone: String,
  shipping_zone_id: Number,
  shipping_address_format: String,
  shipping_custom_field: mongoose.Schema.Types.Mixed,
  shipping_method: String,
  shipping_code: String,
  
  comment: String,
  total: { type: Number, required: true },
  order_status_id: { type: Number, default: 1 },
  affiliate_id: Number,
  commission: Number,
  tracking: String,
  language_id: Number,
  currency_id: Number,
  currency_code: String,
  currency_value: Number,
  ip: String,
  forwarded_ip: String,
  user_agent: String,
  accept_language: String,
  date_added: { type: Date, default: Date.now },
  date_modified: { type: Date, default: Date.now },
  
  // Embedded order items for better performance
  products: [orderItemSchema],
  
  // Order totals breakdown
  totals: [{
    order_total_id: Number,
    code: String,
    title: String,
    value: Number,
    sort_order: Number
  }],
  
  // Order history
  history: [{
    order_history_id: Number,
    order_status_id: Number,
    notify: Boolean,
    comment: String,
    date_added: Date
  }],
  
  // Order tracking info
  shipments: [{
    tracking_number: String, 
    shipping_company: String,
    date_added: Date,
    estimated_delivery: Date,
    status: String
  }],
  
  // Migration verification
  original_mysql_id: Number,
  migration_notes: [String]
}, { 
  collection: 'orders',
  timestamps: true 
});

// Indexes for faster queries - use ONLY schema.index()
orderSchema.index({ customer_id: 1, date_added: -1 });
orderSchema.index({ order_status_id: 1 });
orderSchema.index({ date_added: -1 });
orderSchema.index({ email: 1 });

export default mongoose.model('Order', orderSchema);