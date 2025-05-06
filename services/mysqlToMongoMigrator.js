// services/mysqlToMongoMigrator.js
import { connectMySQL } from '../config/db.js';
import Customer from '../models/customer.model.js';
import dotenv from 'dotenv';

dotenv.config();

export const migrateCustomers = async () => {
  try {
    const mysql = await connectMySQL();

    console.log('Fetching customers from MySQL...');
    const [rows] = await mysql.execute('SELECT * FROM oc_customer');

    for (const row of rows) {
      // Optional: Check if already exists
      const exists = await Customer.findOne({ email: row.email });
      if (exists) {
        console.log(`Skipping existing customer: ${row.email}`);
        continue;
      }

      // Insert into MongoDB
      await Customer.create({
        customer_id: row.customer_id,
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
        salt: row.salt,
        password: row.password,
        status: row.status === 1,
        date_added: row.date_added,
      });

      console.log(`Migrated: ${row.email}`);
    }

    console.log(`✅ Migrated ${rows.length} customers.`);
    await mysql.end();
  } catch (err) {
    console.error('❌ Migration error:', err.message);
  }
};
