// models/category.model.js - COMPLETE CHECK
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  category_id: { type: Number }, // REMOVED unique: true and index: true
  parent_id: { type: Number, default: 0 },
  image: String,
  top: { type: Boolean, default: false },
  column: { type: Number, default: 1 },
  sort_order: { type: Number, default: 0 },
  status: { type: Boolean, default: true },
  date_added: Date,
  date_modified: Date,
  
  // Descriptions for different languages
  descriptions: [{
    language_id: Number,
    name: String,
    description: String,
    meta_title: String,
    meta_description: String,
    meta_keyword: String
  }],
  
  // Path for hierarchical structure
  path: [Number],
  
  // Stores
  stores: [Number],
  
  // Migration info
  migration_notes: [String]
}, { collection: 'categories' });

// Create indexes ONLY with schema.index()
categorySchema.index({ category_id: 1 }, { unique: true });
categorySchema.index({ parent_id: 1 });
categorySchema.index({ 'descriptions.name': 'text' });

export default mongoose.model('Category', categorySchema);