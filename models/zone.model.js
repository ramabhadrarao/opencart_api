// models/zone.model.js - COMPLETE CHECK
import mongoose from 'mongoose';

const zoneSchema = new mongoose.Schema({
  zone_id: { type: Number }, // REMOVED unique: true
  country_id: Number,
  name: String,
  code: String,
  status: { type: Boolean, default: true }
}, { collection: 'zones' });

// Create indexes ONLY with schema.index()
zoneSchema.index({ zone_id: 1 }, { unique: true });
zoneSchema.index({ country_id: 1 });

export default mongoose.model('Zone', zoneSchema);