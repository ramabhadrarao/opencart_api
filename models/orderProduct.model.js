// models/orderProduct.model.js
import mongoose from 'mongoose';

const orderProductOptionSchema = new mongoose.Schema({
  order_option_id: Number,
  product_option_id: Number,
  product_option_value_id: Number,
  name: String,
  value: String,
  type: String
});

const orderProductSchema = new mongoose.Schema({
  order_product_id: Number,
  order_id: Number,
  product_id: Number,
  name: String,
  model: String,
  quantity: Number,
  price: Number,
  total: Number,
  tax: Number,
  reward: Number,
  
  // Order product options
  options: [orderProductOptionSchema],
  
  // Downloads (linked via separate migration)
  download_links: [{
    download_id: Number,
    name: String,
    filename: String,
    mask: String,
    remaining: Number
  }]
}, { collection: 'order_products' });

export default mongoose.model('OrderProduct', orderProductSchema);