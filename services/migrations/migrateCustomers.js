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
  
    for (const row of rows) {
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
  
      console.log(`➡️  ${row.email}`);
    }
  
    await mysql.end();
  };
  