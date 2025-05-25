import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  address_id: { type: Number }, // REMOVED unique: true
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

// Create indexes ONLY with schema.index()
addressSchema.index({ address_id: 1 }, { unique: true });
addressSchema.index({ customer_id: 1 });

export default mongoose.model('Address', addressSchema);