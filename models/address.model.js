// models/address.model.js
import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  address_id: { type: Number, unique: true },
  customer_id: Number,
  firstname: String,
  lastname: String,
  company: String,
  address_1: String,
  address_2: String,
  city: String,
  postcode: String,
  country_id: Number,
  zone_id: Number,
  custom_field: String
}, { collection: 'addresses' });

export default mongoose.model('Address', addressSchema);