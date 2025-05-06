// models/order.model.js
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  order_id: Number,
  customer_id: Number,
  firstname: String,
  lastname: String,
  email: String,
  telephone: String,
  total: Number,
  payment_method: String,
  shipping_method: String,
  comment: String,
  order_status_id: Number,
  date_added: Date
}, { collection: 'orders' });

export default mongoose.model('Order', orderSchema);
