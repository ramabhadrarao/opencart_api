// services/migrations/migrateOrderProducts.js
import OrderProduct from '../../models/orderProduct.model.js';
import { connectMySQL } from '../../config/db.js';

export const migrateOrderProducts = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing order products...');

  const existingCount = await OrderProduct.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Order products already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating order products...');
  const [rows] = await mysql.execute('SELECT * FROM oc_order_product');

  for (const row of rows) {
    try {
      // Get options for this order product
      const [options] = await mysql.execute(
        'SELECT * FROM oc_order_option WHERE order_product_id = ?',
        [row.order_product_id]
      );
      
      // Check for downloads (if this product has downloads)
      const [downloads] = await mysql.execute(`
        SELECT d.* FROM oc_product_to_download pd
        JOIN oc_download d ON pd.download_id = d.download_id
        WHERE pd.product_id = ?
      `, [row.product_id]);
      
      const downloadLinks = downloads.map(dl => ({
        download_id: dl.download_id,
        name: dl.name,
        filename: dl.filename,
        mask: dl.mask,
        remaining: dl.remaining
      }));

      // Create order product with options and downloads
      await OrderProduct.create({
        order_product_id: row.order_product_id,
        order_id: row.order_id,
        product_id: row.product_id,
        name: row.name,
        model: row.model,
        quantity: row.quantity,
        price: row.price,
        total: row.total,
        tax: row.tax,
        reward: row.reward,
        options: options.map(opt => ({
          order_option_id: opt.order_option_id,
          product_option_id: opt.product_option_id,
          product_option_value_id: opt.product_option_value_id,
          name: opt.name,
          value: opt.value,
          type: opt.type
        })),
        download_links: downloadLinks
      });

      console.log(`➡️  Order product #${row.order_product_id}`);
    } catch (error) {
      console.error(`❌ Error migrating order product #${row.order_product_id}:`, error.message);
    }
  }

  await mysql.end();
  console.log('✅ Order products migration completed!');
};