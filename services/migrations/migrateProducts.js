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

  // Get all base products
  const [products] = await mysql.execute('SELECT * FROM oc_product');

  for (const product of products) {
    try {
      // 1. Get descriptions
      const [descriptions] = await mysql.execute(
        'SELECT * FROM oc_product_description WHERE product_id = ?', 
        [product.product_id]
      );
      
      // 2. Get categories
      const [categories] = await mysql.execute(
        'SELECT category_id FROM oc_product_to_category WHERE product_id = ?', 
        [product.product_id]
      );
      
      // 3. Get stores
      const [stores] = await mysql.execute(
        'SELECT store_id FROM oc_product_to_store WHERE product_id = ?', 
        [product.product_id]
      );
      
      // 4. Get additional images
      const [images] = await mysql.execute(
        'SELECT * FROM oc_product_image WHERE product_id = ?', 
        [product.product_id]
      );
      
      // 5. Get attributes
      const [attributeLinks] = await mysql.execute(
        'SELECT * FROM oc_product_attribute WHERE product_id = ?', 
        [product.product_id]
      );
      
      const attributes = [];
      for (const link of attributeLinks) {
        const [attrDetails] = await mysql.execute(
          'SELECT ad.name, ag.attribute_group_id FROM oc_attribute a ' +
          'JOIN oc_attribute_description ad ON a.attribute_id = ad.attribute_id ' +
          'JOIN oc_attribute_group ag ON a.attribute_group_id = ag.attribute_group_id ' +
          'WHERE a.attribute_id = ?',
          [link.attribute_id]
        );
        
        if (attrDetails.length) {
          attributes.push({
            attribute_id: link.attribute_id,
            attribute_group_id: attrDetails[0].attribute_group_id,
            name: attrDetails[0].name,
            text: link.text
          });
        }
      }
      
      // 6. Get options
      const [productOptions] = await mysql.execute(
        'SELECT * FROM oc_product_option WHERE product_id = ?', 
        [product.product_id]
      );
      
      const options = [];
      for (const po of productOptions) {
        const [optionDetails] = await mysql.execute(
          'SELECT od.name, o.type FROM oc_option o ' +
          'JOIN oc_option_description od ON o.option_id = od.option_id ' +
          'WHERE o.option_id = ?',
          [po.option_id]
        );
        
        const [optionValues] = await mysql.execute(
          'SELECT pov.*, ovd.name FROM oc_product_option_value pov ' +
          'JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id ' +
          'WHERE pov.product_option_id = ?',
          [po.product_option_id]
        );
        
        const values = optionValues.map(ov => ({
          product_option_value_id: ov.product_option_value_id,
          option_value_id: ov.option_value_id,
          name: ov.name,
          quantity: ov.quantity,
          subtract: ov.subtract === 1,
          price: ov.price,
          price_prefix: ov.price_prefix,
        }));
        
        options.push({
          product_option_id: po.product_option_id,
          option_id: po.option_id,
          name: optionDetails[0]?.name || '',
          type: optionDetails[0]?.type || '',
          required: po.required === 1,
          values
        });
      }
      
      // 7. Get discounts
      const [discounts] = await mysql.execute(
        'SELECT * FROM oc_product_discount WHERE product_id = ?', 
        [product.product_id]
      );
      
      // 8. Get downloads
      const [downloadLinks] = await mysql.execute(
        'SELECT * FROM oc_product_to_download WHERE product_id = ?', 
        [product.product_id]
      );
      
      const downloads = [];
      for (const dl of downloadLinks) {
        const [downloadDetails] = await mysql.execute(
          'SELECT * FROM oc_download WHERE download_id = ?',
          [dl.download_id]
        );
        
        if (downloadDetails.length) {
          downloads.push({
            download_id: dl.download_id,
            name: downloadDetails[0].name,
            filename: downloadDetails[0].filename,
            mask: downloadDetails[0].mask,
            remaining: downloadDetails[0].remaining
          });
        }
      }
      
      // 9. Get related products
      const [related] = await mysql.execute(
        'SELECT related_id FROM oc_product_related WHERE product_id = ?', 
        [product.product_id]
      );
      
      // Create the product document
      await Product.create({
        product_id: product.product_id,
        model: product.model,
        sku: product.sku,
        upc: product.upc,
        ean: product.ean,
        jan: product.jan,
        isbn: product.isbn,
        mpn: product.mpn,
        location: product.location,
        quantity: product.quantity,
        stock_status_id: product.stock_status_id,
        image: product.image,
        manufacturer_id: product.manufacturer_id,
        shipping: product.shipping === 1,
        price: product.price,
        points: product.points,
        tax_class_id: product.tax_class_id,
        date_available: product.date_available,
        weight: product.weight,
        weight_class_id: product.weight_class_id,
        length: product.length,
        width: product.width,
        height: product.height,
        length_class_id: product.length_class_id,
        subtract: product.subtract === 1,
        minimum: product.minimum,
        sort_order: product.sort_order,
        status: product.status === 1,
        viewed: product.viewed,
        date_added: product.date_added,
        date_modified: product.date_modified,
        
        // Relationships
        descriptions: descriptions.map(d => ({
          language_id: d.language_id,
          name: d.name,
          description: d.description,
          tag: d.tag,
          meta_title: d.meta_title,
          meta_description: d.meta_description,
          meta_keyword: d.meta_keyword
        })),
        categories: categories.map(c => c.category_id),
        stores: stores.map(s => s.store_id),
        additional_images: images.map(img => ({
          product_image_id: img.product_image_id,
          image: img.image,
          sort_order: img.sort_order
        })),
        attributes,
        options,
        discounts: discounts.map(d => ({
          product_discount_id: d.product_discount_id,
          quantity: d.quantity,
          priority: d.priority,
          price: d.price,
          date_start: d.date_start,
          date_end: d.date_end
        })),
        downloads,
        related_products: related.map(r => r.related_id)
      });

      console.log(`✅ Product #${product.product_id} (${descriptions[0]?.name || 'Unnamed'}) migrated`);
    } catch (error) {
      console.error(`❌ Error migrating product #${product.product_id}:`, error.message);
    }
  }

  await mysql.end();
  console.log('🎉 Product migration completed!');
};