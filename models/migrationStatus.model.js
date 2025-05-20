// models/migrationStatus.model.js
import mongoose from 'mongoose';

const migrationStatusSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending'
  },
  first_run: { 
    type: Date,
    default: null
  },
  last_run: { 
    type: Date,
    default: null
  },
  duration_seconds: Number,
  processed: Number,
  succeeded: Number,
  failed: Number,
  error: String,
  stack: String,
  details: mongoose.Schema.Types.Mixed
}, { 
  collection: 'migration_status',
  timestamps: true
});

// Pre-save middleware to set first_run if it's null
migrationStatusSchema.pre('save', function(next) {
  if (!this.first_run && (this.status === 'running' || this.status === 'completed')) {
    this.first_run = new Date();
  }
  next();
});

export default mongoose.model('MigrationStatus', migrationStatusSchema);