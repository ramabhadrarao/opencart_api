// models/checkout.model.js
import mongoose from 'mongoose';

const checkoutSchema = new mongoose.Schema({
  order_id: { type: Number, unique: true },
  customer_id: Number,
  cart_id: mongoose.Schema.Types.ObjectId,
  payment_method: String,
  payment_code: String,
  shipping_method: String,
  shipping_code: String,
  comment: String,
  total: Number,
  order_status_id: { type: Number, default: 1 }, // Default: Pending
  ip_address: String,
  date_added: { type: Date, default: Date.now },
  date_modified: { type: Date, default: Date.now }
}, { collection: 'checkouts' });

export default mongoose.model('Checkout', checkoutSchema);