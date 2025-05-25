// models/manufacturer.model.js - COMPLETE CHECK
import mongoose from 'mongoose';

const manufacturerSchema = new mongoose.Schema({
  manufacturer_id: { type: Number }, // REMOVED unique: true
  name: String,
  image: String,
  sort_order: { type: Number, default: 0 }
}, { collection: 'manufacturers' });

// Create indexes ONLY with schema.index()
manufacturerSchema.index({ manufacturer_id: 1 }, { unique: true });

export default mongoose.model('Manufacturer', manufacturerSchema);