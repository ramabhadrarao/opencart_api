// scripts/migrate.js
import { connectMongoDB } from '../config/db.js';
import { migrateCustomers } from '../services/mysqlToMongoMigrator.js';

const run = async () => {
  await connectMongoDB();
  await migrateCustomers();
  process.exit(0);
};

run();
