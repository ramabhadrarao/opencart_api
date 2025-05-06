import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  product_id: Number,
  name: String,
  model: String,
  description: String,
  price: Number,
  quantity: Number,
  image: String,
  additional_images: [String],
  status: Boolean,
  categories: [{
    category_id: Number,
    name: String
  }],
  options: [{
    option_id: Number,
    name: String,
    values: [{
      option_value_id: Number,
      value: String,
      price: Number
    }]
  }],
  specifications: [{
    title: String,
    value: String
  }],
  store_ids: [Number],
  date_available: Date,
  date_added: Date
}, { collection: 'products' });

export default mongoose.model('Product', productSchema);
