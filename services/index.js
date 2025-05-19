// services/index.js (with uploads)
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

const run = async () => {
  console.log('🚀 Starting MongoDB migration runner...');
  
  await connectMongoDB();

  // Migration with error handling
  const runMigration = async (name, migrationFn) => {
    try {
      console.log(`\n📋 Starting migration: ${name}`);
      await migrationFn();
      console.log(`✅ Migration completed: ${name}`);
      return true;
    } catch (error) {
      console.error(`❌ Error in ${name} migration: ${error.message}`);
      return false;
    }
  };

  // Statistics
  const stats = {
    success: 0,
    failed: 0
  };

  // Run migrations in sequence
  const migrations = [
    { name: 'Customers', fn: migrateCustomers },
    { name: 'Categories', fn: migrateCategories },
        { name: 'Manufacturers', fn: migrateManufacturers }, // Added to the migration list

    { name: 'Products', fn: migrateProducts },
    { name: 'Orders', fn: migrateOrders },
    { name: 'Order Products', fn: migrateOrderProducts },
    { name: 'Addresses', fn: migrateAddresses },
    { name: 'Product Uploads', fn: migrateProductUploads },
    { name: 'Admins', fn: migrateAdmins },
  ];

  for (const migration of migrations) {
    const success = await runMigration(migration.name, migration.fn);
    if (success) {
      stats.success++;
    } else {
      stats.failed++;
    }
  }

  console.log('\n📊 Migration Summary:');
  console.log(`✅ Successful migrations: ${stats.success}`);
  console.log(`❌ Failed migrations: ${stats.failed}`);
  console.log('🏁 Migration process completed');
  
  process.exit(0);
};

run().catch(error => {
  console.error('❌ Fatal migration error:', error.message);
  process.exit(1);
});