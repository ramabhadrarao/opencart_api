// scripts/retryFailedMigration.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MigrationStatus from '../models/migrationStatus.model.js';
import { connectMySQL } from '../config/db.js';
import { BatchMigrator } from '../services/batchMigrator.js';

// Import all migration transformers
import { migrateCustomers } from '../services/migrations/migrateCustomers.js';
import { migrateProducts } from '../services/migrations/migrateProducts.js';
import { migrateOrders } from '../services/migrations/migrateOrders.js';
// Add other imports as needed

dotenv.config();

/**
 * Retry a failed migration for specific IDs
 * @param {string} migrationName - Name of the migration to retry
 */
const retryFailedMigration = async (migrationName) => {
  try {
    console.log(`🔄 Retrying failed migration: ${migrationName}`);
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');
    
    // Get migration status
    const migrationStatus = await MigrationStatus.findOne({ name: migrationName });
    
    if (!migrationStatus) {
      console.error(`❌ Migration '${migrationName}' not found in status records`);
      return;
    }
    
    if (migrationStatus.status !== 'failed') {
      console.log(`⚠️ Migration '${migrationName}' is not in failed state (current: ${migrationStatus.status})`);
      
      const proceed = await askQuestion('Do you want to proceed anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('❌ Operation cancelled');
        return;
      }
    }
    
    // Choose migration function based on name
    let migrationFn;
    switch (migrationName.toLowerCase()) {
      case 'customers':
        migrationFn = migrateCustomers;
        break;
      case 'products':
        migrationFn = migrateProducts;
        break;
      case 'orders':
        migrationFn = migrateOrders;
        break;
      // Add other cases as needed
      default:
        console.error(`❌ No implementation found for '${migrationName}' migration`);
        return;
    }
    
    // Execute migration
    console.log(`🚀 Starting retry for '${migrationName}'`);
    const result = await migrationFn();
    
    // Update migration status
    await MigrationStatus.findOneAndUpdate(
      { name: migrationName },
      {
        $set: {
          status: 'completed',
          last_run: new Date(),
          duration_seconds: (result.endTime - result.startTime) / 1000,
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          error: null
        }
      }
    );
    
    console.log(`✅ Migration '${migrationName}' retry completed successfully`);
    
  } catch (err) {
    console.error('❌ Error retrying migration:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

// Helper function to prompt for input
const askQuestion = (question) => {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise(resolve => {
    readline.question(question, answer => {
      readline.close();
      resolve(answer);
    });
  });
};

// Get migration name from command line argument
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('❌ Please specify a migration name to retry');
  console.log('Usage: node scripts/retryFailedMigration.js <migration_name>');
  process.exit(1);
}

// Run the retry
retryFailedMigration(migrationName);