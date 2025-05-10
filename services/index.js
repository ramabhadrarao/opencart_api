// services/index.js (fully updated)
import { connectMongoDB } from '../config/db.js';
import { migrateCustomers } from './migrations/migrateCustomers.js';
import { migrateCategories } from './migrations/migrateCategories.js';
import { migrateProducts } from './migrations/migrateProducts.js';
import { migrateOrders } from './migrations/migrateOrders.js';
import { migrateOrderProducts } from './migrations/migrateOrderProducts.js';
import { migrateAddresses } from './migrations/migrateAddresses.js';
const run = async () => {
  console.log('🚀 Starting MongoDB migration runner...');
  
  await connectMongoDB();

  try {
    // Migrate in proper order based on dependencies
    await migrateCustomers();        // Standalone
    await migrateCategories();       // Standalone
    await migrateProducts();         // Depends on categories
    await migrateOrders();           // Depends on customers
    await migrateOrderProducts();    // Depends on orders and products
    await migrateAddresses();
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }

  console.log('✅ All migrations completed (or skipped)');
  process.exit(0);
};

run();