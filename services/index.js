import { connectMongoDB } from '../config/db.js';
import { migrateCustomers } from './migrations/migrateCustomers.js';
import { migrateOrders } from './migrations/migrateOrders.js';
import { migrateProducts } from './migrations/migrateProducts.js';

// import { migrateProducts } from './migrations/migrateProducts.js'; // when ready

const run = async () => {
  console.log('🚀 Starting MongoDB migration runner...');
  
  await connectMongoDB();

  try {
    await migrateCustomers();   // will skip if already migrated
    await migrateOrders();      // will skip if already migrated
    await migrateProducts(); // optional
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }

  console.log('✅ All migrations completed (or skipped)');
  process.exit(0);
};

run();
