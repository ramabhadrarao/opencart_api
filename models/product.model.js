// models/product.model.js
import mongoose from 'mongoose';

const productOptionValueSchema = new mongoose.Schema({
  product_option_value_id: Number,
  option_value_id: Number,
  name: String,
  price: Number,
  price_prefix: String,
  quantity: Number
});

const productOptionSchema = new mongoose.Schema({
  product_option_id: Number,
  option_id: Number,
  name: String,
  type: String,
  required: Boolean,
  values: [productOptionValueSchema]
});

const productAttributeSchema = new mongoose.Schema({
  attribute_id: Number,
  attribute_group_id: Number,
  name: String,
  text: String
});

const productDiscountSchema = new mongoose.Schema({
  product_discount_id: Number,
  quantity: Number,
  priority: Number,
  price: Number,
  date_start: Date,
  date_end: Date
});

const productDownloadSchema = new mongoose.Schema({
  download_id: Number,
  name: String,
  filename: String,
  mask: String,
  remaining: Number
});

const productSchema = new mongoose.Schema({
  product_id: { type: Number, unique: true },
  model: String,
  sku: String,
  upc: String,
  ean: String,
  jan: String,
  isbn: String,
  mpn: String,
  location: String,
  quantity: { type: Number, default: 0 },
  stock_status_id: Number,
  image: String,
  manufacturer_id: Number,
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
  date_added: Date,
  date_modified: Date,
  
  // Relationships (populated from related tables)
  descriptions: [{
    language_id: Number,
    name: String,
    description: String,
    tag: String,
    meta_title: String,
    meta_description: String,
    meta_keyword: String
  }],
  categories: [Number], // Array of category_ids
  stores: [Number], // Array of store_ids
  additional_images: [{
    product_image_id: Number,
    image: String,
    sort_order: Number
  }],
  attributes: [productAttributeSchema],
  options: [productOptionSchema],
  discounts: [productDiscountSchema],
  downloads: [productDownloadSchema],
  related_products: [Number], // Array of related product_ids
  
  // Virtual field for main description (convenience)
  main_description: {
    type: Object,
    default: null
  }
}, { collection: 'products' });

// Virtual for getting the main description (language_id = 1 or first available)
productSchema.virtual('mainDescription').get(function() {
  if (!this.descriptions || !this.descriptions.length) return null;
  const defaultLang = this.descriptions.find(d => d.language_id === 1);
  return defaultLang || this.descriptions[0];
});

export default mongoose.model('Product', productSchema);