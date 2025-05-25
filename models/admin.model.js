import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  user_id: { type: Number }, // REMOVED unique: true
  user_group_id: Number,
  username: { type: String }, // REMOVED unique: true
  password: String,
  salt: String,
  firstname: String,
  lastname: String,
  email: String,
  image: String,
  code: String,
  ip: String,
  status: Boolean,
  date_added: Date
}, { collection: 'admins' });

// Create indexes ONLY with schema.index()
adminSchema.index({ user_id: 1 }, { unique: true });
adminSchema.index({ username: 1 }, { unique: true });

export default mongoose.model('Admin', adminSchema);