// services/migrations/migrateCustomers.js
import Customer from '../../models/customer.model.js';
import { connectMySQL } from '../../config/db.js';

export const migrateCustomers = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing customers...');

  const existingCount = await Customer.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Customers already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating customers...');
  const [rows] = await mysql.execute('SELECT * FROM oc_customer');

  // Track already processed emails to avoid duplicates
  const processedEmails = new Set();

  for (const row of rows) {
    try {
      // Skip duplicates
      if (processedEmails.has(row.email.toLowerCase())) {
        console.log(`⚠️ Skipping duplicate email: ${row.email}`);
        continue;
      }

      // Add to processed emails set
      processedEmails.add(row.email.toLowerCase());

      await Customer.create({
        customer_id: row.customer_id,
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
        salt: row.salt,
        password: row.password,
        status: row.status === 1,
        date_added: row.date_added
      });

      console.log(`➡️ ${row.email}`);
    } catch (err) {
      // Log the error but continue with next customer
      console.error(`❌ Error migrating customer #${row.customer_id} (${row.email}): ${err.message}`);
    }
  }

  await mysql.end();
  console.log('✅ Customer migration completed!');
};