// models/admin.model.js
import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  user_id: { type: Number, unique: true },
  user_group_id: Number,
  username: { type: String, unique: true },
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

export default mongoose.model('Admin', adminSchema);