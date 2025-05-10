// models/country.model.js
import mongoose from 'mongoose';

const countrySchema = new mongoose.Schema({
  country_id: { type: Number, unique: true },
  name: String,
  iso_code_2: String,
  iso_code_3: String,
  address_format: String,
  postcode_required: Boolean,
  status: { type: Boolean, default: true }
}, { collection: 'countries' });

export default mongoose.model('Country', countrySchema);