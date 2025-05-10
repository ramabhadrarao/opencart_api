// models/manufacturer.model.js
import mongoose from 'mongoose';

const manufacturerSchema = new mongoose.Schema({
  manufacturer_id: { type: Number, unique: true },
  name: String,
  image: String,
  sort_order: { type: Number, default: 0 }
}, { collection: 'manufacturers' });

export default mongoose.model('Manufacturer', manufacturerSchema);