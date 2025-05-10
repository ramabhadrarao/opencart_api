// models/cart.model.js
import mongoose from 'mongoose';

const cartItemSchema = new mongoose.Schema({
  product_id: { type: Number, required: true },
  name: { type: String, required: true },
  model: { type: String },
  quantity: { type: Number, default: 1, min: 1 },
  price: { type: Number, required: true },
  options: [{
    option_id: Number,
    option_name: String,
    option_value_id: Number,
    option_value_name: String,
    price_modifier: Number
  }],
  final_price: { type: Number },
  subtotal: { type: Number },
  image: String
});

const cartSchema = new mongoose.Schema({
  customer_id: { type: Number, required: true, unique: true },
  items: [cartItemSchema],
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'carts' });

export default mongoose.model('Cart', cartSchema);