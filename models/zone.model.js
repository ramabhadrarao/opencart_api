// models/zone.model.js
import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  zone_id: { type: Number, unique: true },
  country_id: Number,
  name: String,
  code: String,
  status: { type: Boolean, default: true }
}, { collection: 'zones' });

export default mongoose.model('Zone', zoneSchema);