// models/category.model.js
import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  category_id: { type: Number, unique: true, index: true },
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

// Create indexes
categorySchema.index({ 'descriptions.name': 'text' });
categorySchema.index({ parent_id: 1 });

export default mongoose.model('Category', categorySchema);