import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id: { type: Number, required: true }, // REMOVED unique: true and index: true
  model: { type: String },
  sku: { type: String },
  upc: String,
  ean: String,
  jan: String,
  isbn: String,
  mpn: String,
  location: String,
  quantity: { type: Number, default: 0 },
  stock_status_id: Number,
  image: String,
  manufacturer_id: { type: Number },
  shipping: { type: Boolean, default: true },
  price: { type: Number, default: 0 },
  points: { type: Number, default: 0 },
  tax_class_id: Number,
  date_available: Date,
  weight: Number,
  weight_class_id: Number,
  length: Number,
  width: Number,
  height: Number,
  length_class_id: Number,
  subtract: { type: Boolean, default: true },
  minimum: { type: Number, default: 1 },
  sort_order: { type: Number, default: 0 },
  status: { type: Boolean, default: true },
  viewed: { type: Number, default: 0 },
  date_added: { type: Date },
  date_modified: { type: Date },
  
  // Embedded documents
  descriptions: [{
    language_id: Number,
    name: { type: String },
    description: String,
    tag: String,
    meta_title: String,
    meta_description: String,
    meta_keyword: String
  }],
  
  categories: [{ type: Number }],
  stores: [Number],
  
  additional_images: [{
    product_image_id: Number,
    image: String,
    sort_order: Number
  }],
  
  attributes: [{
    attribute_id: Number,
    attribute_group_id: Number,
    name: String,
    text: String
  }],
  
  options: [{
    product_option_id: Number,
    option_id: Number,
    name: String,
    type: String,
    value: String,        // ✅ Good - this was missing before
    required: Boolean,
    sort_order: Number,   // ✅ Good - this was missing before  
    values: [{
      product_option_value_id: Number,
      option_value_id: Number,
      name: String,
      quantity: Number,
      subtract: Boolean,
      price: Number,
      price_prefix: String,
      weight: Number,
      weight_prefix: String,
      uploaded_file: String
    }]
  }],
  
  // ⚠️ CORRECTED: Added missing customer_group_id field
  discounts: [{
    product_discount_id: Number,
    customer_group_id: Number,  // ← This was missing in your version
    quantity: Number,
    priority: Number,
    price: Number,
    date_start: Date,
    date_end: Date
  }],
  
  special_prices: [{
    product_special_id: Number,
    customer_group_id: Number,
    priority: Number,
    price: Number,
    date_start: Date,
    date_end: Date
  }],
  
  downloads: [{
    download_id: Number,
    name: String,
    filename: String,
    mask: String,
    remaining: Number
  }],
  
  related_products: [Number],
  tags: [String],
  
  // Migration verification fields
  original_mysql_id: Number,
  migration_notes: [String],
  file_verification_status: {
    total_files: { type: Number, default: 0 },
    verified_files: { type: Number, default: 0 },
    missing_files: [String],
    last_verified: Date
  }
}, { 
  collection: 'products',
  strict: false
});

// Create indexes ONLY with schema.index()
productSchema.index({ product_id: 1 }, { unique: true });
productSchema.index({ model: 1 });
productSchema.index({ sku: 1 }, { sparse: true });
productSchema.index({ manufacturer_id: 1 });
productSchema.index({ price: 1 });
productSchema.index({ status: 1 });
productSchema.index({ date_added: 1 });

// Text index for search
productSchema.index({
  'descriptions.name': 'text',
  'descriptions.description': 'text',
  model: 'text',
  sku: 'text'
});

export default mongoose.model('Product', productSchema);