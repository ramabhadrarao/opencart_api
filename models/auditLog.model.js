// models/auditLog.model.js
import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  user_id: Number,
  user_type: { type: String, enum: ['customer', 'admin'], required: true },
  username: String,
  email: String,
  ip_address: String,
  location: {
    country: String,
    region: String,
    city: String,
    latitude: Number,
    longitude: Number,
    timezone: String
  },
  action: { type: String, required: true },
  entity_type: { type: String, required: true }, // e.g., product, customer, order
  entity_id: { type: mongoose.Schema.Types.Mixed, required: true },
  previous_state: mongoose.Schema.Types.Mixed,
  new_state: mongoose.Schema.Types.Mixed,
  details: String,
  created_at: { type: Date, default: Date.now }
}, { collection: 'audit_logs' });

// Create indexes for faster queries
auditLogSchema.index({ user_id: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ created_at: 1 });

export default mongoose.model('AuditLog', auditLogSchema);