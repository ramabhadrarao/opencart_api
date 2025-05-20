// services/index.js
import { connectMongoDB } from '../config/db.js';
import { migrateCustomers } from './migrations/migrateCustomers.js';
import { migrateAddresses } from './migrations/migrateAddresses.js';
import { migrateCategories } from './migrations/migrateCategories.js';
import { migrateManufacturers } from './migrations/migrateManufacturers.js';
import { migrateProducts } from './migrations/migrateProducts.js';
import { migrateOrders } from './migrations/migrateOrders.js';
import { migrateOrderProducts } from './migrations/migrateOrderProducts.js';
import { migrateProductUploads } from './migrations/migrateProductUploads.js';
import { migrateAdmins } from './migrations/migrateAdmins.js';
import { migrateCoupons } from './migrations/migrateCoupons.js';
import MigrationStatus from '../models/migrationStatus.model.js';

/**
 * Run migrations with progress tracking and error handling
 */
const run = async () => {
  console.log('🚀 Starting MongoDB migration runner...');
  
  await connectMongoDB();

  // Statistics
  const stats = {
    success: 0,
    failed: 0,
    startTime: new Date(),
    endTime: null
  };

  // Create or update migration status
  const createMigrationStatus = async (name, status, details = {}) => {
    try {
      await MigrationStatus.findOneAndUpdate(
        { name },
        {
          $set: {
            name,
            status,
            last_run: new Date(),
            ...details
          }
        },
        { upsert: true }
      );
    } catch (err) {
      console.error(`Error updating migration status for ${name}:`, err.message);
    }
  };

  // Migration with error handling
  const runMigration = async (name, migrationFn) => {
    try {
      console.log(`\n📋 Starting migration: ${name}`);
      await createMigrationStatus(name, 'running');
      
      const startTime = new Date();
      const result = await migrationFn();
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      
      console.log(`✅ Migration completed: ${name} (in ${duration.toFixed(2)}s)`);
      
      await createMigrationStatus(name, 'completed', {
        duration_seconds: duration,
        processed: result?.processed || 0,
        succeeded: result?.succeeded || 0,
        failed: result?.failed || 0
      });
      
      stats.success++;
      return true;
    } catch (error) {
      console.error(`❌ Error in ${name} migration: ${error.message}`);
      
      await createMigrationStatus(name, 'failed', {
        error: error.message,
        stack: error.stack
      });
      
      stats.failed++;
      return false;
    }
  };

  // Run migrations in optimized sequence with automatic retry
  const migrations = [
    // Core entities first
    { name: 'Customers', fn: migrateCustomers, critical: true },
    { name: 'Addresses', fn: migrateAddresses, critical: false },
    { name: 'Categories', fn: migrateCategories, critical: true },
    { name: 'Manufacturers', fn: migrateManufacturers, critical: false },
    
    // Products and related entities
    { name: 'Products', fn: migrateProducts, critical: true },
    { name: 'Product Uploads', fn: migrateProductUploads, critical: false },
    
    // Orders and related entities
    { name: 'Orders', fn: migrateOrders, critical: true },
    { name: 'Order Products', fn: migrateOrderProducts, critical: false },
    
    // Additional entities
    { name: 'Admins', fn: migrateAdmins, critical: true },
    { name: 'Coupons', fn: migrateCoupons, critical: false }
  ];

  for (const migration of migrations) {
    let success = await runMigration(migration.name, migration.fn);
    
    // Auto-retry critical migrations once
    if (!success && migration.critical) {
      console.log(`⚠️ Critical migration failed. Retrying ${migration.name}...`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
      success = await runMigration(`${migration.name} (retry)`, migration.fn);
    }
    
    // Exit if critical migration fails twice
    if (!success && migration.critical) {
      console.error(`❌ Critical migration ${migration.name} failed twice. Stopping migrations.`);
      break;
    }
  }

  stats.endTime = new Date();
  const totalDuration = (stats.endTime - stats.startTime) / 1000;

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successful migrations: ${stats.success}`);
  console.log(`❌ Failed migrations: ${stats.failed}`);
  console.log(`⏱️ Total duration: ${totalDuration.toFixed(2)} seconds`);
  console.log('🏁 Migration process completed');
  
  process.exit(0);
};

// Run with error handling
run().catch(error => {
  console.error('❌ Fatal migration error:', error.message);
  process.exit(1);
});