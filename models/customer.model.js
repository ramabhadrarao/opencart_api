// models/customer.model.js
import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
    customer_id: Number,
    firstname: String,
    lastname: String,
    email: { type: String, unique: true },
    telephone: String,
    salt: String,
    password: String,
    status: { type: Boolean, default: true },
    date_added: Date,
    reset_token: String,
    reset_token_expiry: Date
  }, { collection: 'customers' });

export default mongoose.model('Customer', customerSchema);
