// services/migrations/migrateProducts.js
import { connectMySQL } from '../../config/db.js';
import Product from '../../models/product.model.js';

export const migrateProducts = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking if products are already migrated...');

  const existingCount = await Product.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Products already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating products...');

  // 1. Get all base products
  const [products] = await mysql.execute('SELECT * FROM oc_product');

  for (const product of products) {
    // 2. Description
    const [descRes] = await mysql.execute(
      'SELECT name, description FROM oc_product_description WHERE product_id = ?', [product.product_id]
    );
    const desc = descRes[0] || {};

    // 3. Additional images
    const [images] = await mysql.execute(
      'SELECT image FROM oc_product_image WHERE product_id = ?', [product.product_id]
    );

    // 4. Categories
    const [catLinks] = await mysql.execute(
      'SELECT category_id FROM oc_product_to_category WHERE product_id = ?', [product.product_id]
    );

    const categories = [];
    for (const cl of catLinks) {
      const [catData] = await mysql.execute(
        'SELECT c.category_id, cd.name FROM oc_category c JOIN oc_category_description cd ON c.category_id = cd.category_id WHERE c.category_id = ?',
        [cl.category_id]
      );
      if (catData.length) categories.push(catData[0]);
    }

    // 5. Options and Values
    const [options] = await mysql.execute(
      'SELECT * FROM oc_product_option WHERE product_id = ?', [product.product_id]
    );

    const finalOptions = [];
    for (const opt of options) {
      const [optName] = await mysql.execute(
        'SELECT name FROM oc_option_description WHERE option_id = ?', [opt.option_id]
      );
      const [values] = await mysql.execute(
        'SELECT pov.option_value_id, ovd.name as value, pov.price FROM oc_product_option_value pov JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id WHERE pov.product_option_id = ?',
        [opt.product_option_id]
      );
      finalOptions.push({
        option_id: opt.option_id,
        name: optName[0]?.name,
        values
      });
    }

    // 6. Specifications (custom table)
    const [specs] = await mysql.execute(
      'SELECT title, value FROM product_specifications WHERE product_id = ?', [product.product_id]
    );

    // 7. Store IDs
    const [stores] = await mysql.execute(
      'SELECT store_id FROM oc_product_to_store WHERE product_id = ?', [product.product_id]
    );

    // Final insert
    await Product.create({
      product_id: product.product_id,
      name: desc.name,
      model: product.model,
      description: desc.description,
      price: product.price,
      quantity: product.quantity,
      image: product.image,
      additional_images: images.map(img => img.image),
      status: product.status === 1,
      categories,
      options: finalOptions,
      specifications: specs,
      store_ids: stores.map(s => s.store_id),
      date_available: product.date_available,
      date_added: product.date_added
    });

    console.log(`✅ Product #${product.product_id} migrated`);
  }

  await mysql.end();
  console.log('🎉 Product migration completed!');
};
