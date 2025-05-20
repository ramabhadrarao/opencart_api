// Updated models/product.model.js with improved schema design
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id: { 
    type: Number, 
    unique: true,
    required: true,
    index: true 
  },
  model: { type: String, index: true },
  sku: { type: String, sparse: true, index: true },
  upc: String,
  ean: String,
  jan: String,
  isbn: String,
  mpn: String,
  location: String,
  quantity: { type: Number, default: 0 },
  stock_status_id: Number,
  image: String,
  manufacturer_id: { type: Number, index: true },
  shipping: { type: Boolean, default: true },
  price: { type: Number, default: 0, index: true },
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
  status: { type: Boolean, default: true, index: true },
  viewed: { type: Number, default: 0 },
  date_added: { type: Date, index: true },
  date_modified: { type: Date },
  
  // Embedded documents (previously nested schemas)
  descriptions: [{
    language_id: Number,
    name: { type: String, index: true },
    description: String,
    tag: String,
    meta_title: String,
    meta_description: String,
    meta_keyword: String
  }],
  
  categories: [{ type: Number, index: true }],
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
    required: Boolean,
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
  
  discounts: [{
    product_discount_id: Number,
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
  tags: [String]
}, { 
  collection: 'products',
  timestamps: true,
  strict: false // Allow dynamic attributes for backward compatibility
});

// Create text index for search
productSchema.index({
  'descriptions.name': 'text',
  'descriptions.description': 'text',
  model: 'text',
  sku: 'text'
});

// Virtual for getting the main description
productSchema.virtual('mainDescription').get(function() {
  if (!this.descriptions || !this.descriptions.length) return null;
  const defaultLang = this.descriptions.find(d => d.language_id === 1);
  return defaultLang || this.descriptions[0];
});

export default mongoose.model('Product', productSchema);