import Order from '../../models/order.model.js';
import { connectMySQL } from '../../config/db.js';


export const migrateOrders = async () => {
    const mysql = await connectMySQL();
    console.log('🔎 Checking existing orders...');
  
    const existingCount = await Order.countDocuments();
    if (existingCount > 0) {
      console.log('✅ Orders already migrated. Skipping...');
      await mysql.end();
      return;
    }
  
    console.log('📦 Migrating orders...');
    const [rows] = await mysql.execute('SELECT * FROM oc_order');
  
    for (const row of rows) {
      await Order.create({
        order_id: row.order_id,
        customer_id: row.customer_id,
        firstname: row.firstname,
        lastname: row.lastname,
        email: row.email,
        telephone: row.telephone,
        total: row.total,
        payment_method: row.payment_method,
        shipping_method: row.shipping_method,
        comment: row.comment,
        order_status_id: row.order_status_id,
        date_added: row.date_added
      });
  
      console.log(`➡️  Order #${row.order_id}`);
    }
  
    await mysql.end();
  };
  