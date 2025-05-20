// services/index.js (optimized)
import { connectMongoDB } from '../config/db.js';
import { migrateCustomers } from './migrations/migrateCustomers.js';
import { migrateCategories } from './migrations/migrateCategories.js';
import { migrateProducts } from './migrations/migrateProducts.js';
import { migrateOrders } from './migrations/migrateOrders.js';
import { migrateOrderProducts } from './migrations/migrateOrderProducts.js';
import { migrateAddresses } from './migrations/migrateAddresses.js';
import { migrateProductUploads } from './migrations/migrateProductUploads.js';
import { migrateAdmins } from './migrations/migrateAdmins.js';
import { migrateManufacturers } from './migrations/migrateManufacturers.js';

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

  // Migration with error handling
  const runMigration = async (name, migrationFn) => {
    try {
      console.log(`\n📋 Starting migration: ${name}`);
      const startTime = new Date();
      await migrationFn();
      const endTime = new Date();
      const duration = (endTime - startTime) / 1000;
      console.log(`✅ Migration completed: ${name} (in ${duration.toFixed(2)}s)`);
      stats.success++;
      return true;
    } catch (error) {
      console.error(`❌ Error in ${name} migration: ${error.message}`);
      stats.failed++;
      return false;
    }
  };

  // Run migrations in sequence with automatic retry
  const migrations = [
    { name: 'Customers', fn: migrateCustomers, critical: true },
    { name: 'Categories', fn: migrateCategories, critical: true },
    { name: 'Manufacturers', fn: migrateManufacturers, critical: false },
    { name: 'Products', fn: migrateProducts, critical: true },
    { name: 'Orders', fn: migrateOrders, critical: true },
    { name: 'Order Products', fn: migrateOrderProducts, critical: true },
    { name: 'Addresses', fn: migrateAddresses, critical: false },
    { name: 'Product Uploads', fn: migrateProductUploads, critical: false },
    { name: 'Admins', fn: migrateAdmins, critical: true }
  ];

  for (const migration of migrations) {
    let success = await runMigration(migration.name, migration.fn);
    
    // Auto-retry critical migrations once
    if (!success && migration.critical) {
      console.log(`⚠️ Critical migration failed. Retrying ${migration.name}...`);
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