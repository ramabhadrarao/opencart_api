// models/coupon.model.js
import mongoose from 'mongoose';

const couponHistorySchema = new mongoose.Schema({
  order_id: Number,
  customer_id: Number,
  amount: Number,
  date_added: { type: Date, default: Date.now }
});

const couponSchema = new mongoose.Schema({
  coupon_id: { type: Number, unique: true },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['P', 'F'], default: 'P' }, // P = Percentage, F = Fixed Amount
  discount: { type: Number, required: true },
  logged: { type: Boolean, default: false }, // Requires customer to be logged in
  shipping: { type: Boolean, default: false }, // Free shipping
  total: { type: Number, default: 0 }, // Minimum order amount
  date_start: { type: Date, default: Date.now },
  date_end: { type: Date },
  uses_total: { type: Number, default: 1 }, // Max uses
  uses_customer: { type: Number, default: 1 }, // Uses per customer
  status: { type: Boolean, default: true },
  date_added: { type: Date, default: Date.now },
  
  // Relations
  products: [{ type: Number }], // Array of product_ids
  categories: [{ type: Number }], // Array of category_ids
  
  // History
  history: [couponHistorySchema]
}, { collection: 'coupons' });

export default mongoose.model('Coupon', couponSchema);