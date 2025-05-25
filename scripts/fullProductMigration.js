// scripts/fullProductMigration.js
import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import Product from '../models/product.model.js';
import Category from '../models/category.model.js';

dotenv.config();

// Connect to both databases
const connectDBs = async () => {
  // Connect to MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');
  
  // Connect to MySQL
  const mysqlConn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
  });
  
  console.log('✅ MySQL connected');
  return mysqlConn;
};

// Helper function to try parsing JSON
const tryParseJson = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return jsonString;
  }
};

// Process a single product with all related data
const processProduct = async (product, mysql) => {
  try {
    // Get descriptions
    const [descriptions] = await mysql.execute(
      'SELECT * FROM oc_product_description WHERE product_id = ?',
      [product.product_id]
    );
    
    // Get categories
    const [categories] = await mysql.execute(
      'SELECT category_id FROM oc_product_to_category WHERE product_id = ?',
      [product.product_id]
    );
    
    // Get stores
    const [stores] = await mysql.execute(
      'SELECT store_id FROM oc_product_to_store WHERE product_id = ?',
      [product.product_id]
    );
    
    // Get additional images
    const [images] = await mysql.execute(
      'SELECT * FROM oc_product_image WHERE product_id = ?',
      [product.product_id]
    );
    
    // Get attributes
    const [attributes] = await mysql.execute(
      'SELECT * FROM oc_product_attribute WHERE product_id = ?',
      [product.product_id]
    );
    
    // Process attributes to include attribute names
    const processedAttributes = [];
    for (const attr of attributes) {
      try {
        const [attrDetails] = await mysql.execute(
          'SELECT ad.name, ag.attribute_group_id FROM oc_attribute a ' +
          'JOIN oc_attribute_description ad ON a.attribute_id = ad.attribute_id ' +
          'JOIN oc_attribute_group ag ON a.attribute_group_id = ag.attribute_group_id ' +
          'WHERE a.attribute_id = ? AND ad.language_id = 1',
          [attr.attribute_id]
        );
        
        if (attrDetails && attrDetails.length > 0) {
          processedAttributes.push({
            attribute_id: parseInt(attr.attribute_id),
            attribute_group_id: parseInt(attrDetails[0].attribute_group_id),
            name: attrDetails[0].name,
            text: attr.text
          });
        }
      } catch (err) {
        console.error(`Error processing attribute ${attr.attribute_id}:`, err.message);
      }
    }
    
    // Get product options
    const [options] = await mysql.execute(
      'SELECT * FROM oc_product_option WHERE product_id = ?',
      [product.product_id]
    );
    
    // Process options and option values
    const processedOptions = [];
    for (const option of options) {
      try {
        // Get option name and type
        const [optionDetails] = await mysql.execute(
          'SELECT od.name, o.type FROM oc_option o ' +
          'JOIN oc_option_description od ON o.option_id = od.option_id ' +
          'WHERE o.option_id = ? AND od.language_id = 1',
          [option.option_id]
        );
        
        // Get option values
        const [optionValues] = await mysql.execute(
          'SELECT pov.*, ovd.name FROM oc_product_option_value pov ' +
          'JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id ' +
          'WHERE pov.product_option_id = ? AND ovd.language_id = 1',
          [option.product_option_id]
        );
        
        const processedValues = optionValues.map(value => ({
          product_option_value_id: parseInt(value.product_option_value_id),
          option_value_id: parseInt(value.option_value_id),
          name: value.name || '',
          quantity: parseInt(value.quantity) || 0,
          subtract: value.subtract === 1,
          price: parseFloat(value.price) || 0,
          price_prefix: value.price_prefix || '+',
          weight: parseFloat(value.weight) || 0,
          weight_prefix: value.weight_prefix || '+',
          uploaded_file: value.uploaded_file || ''
        }));
        
        if (optionDetails && optionDetails.length > 0) {
          processedOptions.push({
            product_option_id: parseInt(option.product_option_id),
            option_id: parseInt(option.option_id),
            name: optionDetails[0].name || '',
            type: optionDetails[0].type || '',
            required: option.required === 1,
            values: processedValues
          });
        }
      } catch (err) {
        console.error(`Error processing option ${option.product_option_id}:`, err.message);
      }
    }
    
    // Get discounts, specials, and related products
    const [discounts] = await mysql.execute(
      'SELECT * FROM oc_product_discount WHERE product_id = ?',
      [product.product_id]
    );
    
    const [specials] = await mysql.execute(
      'SELECT * FROM oc_product_special WHERE product_id = ?',
      [product.product_id]
    );
    
    const [related] = await mysql.execute(
      'SELECT related_id FROM oc_product_related WHERE product_id = ?',
      [product.product_id]
    );
    
    // Get downloads
    const [downloads] = await mysql.execute(
      'SELECT d.* FROM oc_product_to_download pd ' +
      'JOIN oc_download d ON pd.download_id = d.download_id ' +
      'WHERE pd.product_id = ?',
      [product.product_id]
    );
    
    // Prepare the final product object
    return {
      product_id: parseInt(product.product_id),
      model: product.model || '',
      sku: product.sku || '',
      upc: product.upc || '',
      ean: product.ean || '',
      jan: product.jan || '',
      isbn: product.isbn || '',
      mpn: product.mpn || '',
      location: product.location || '',
      quantity: parseInt(product.quantity) || 0,
      stock_status_id: parseInt(product.stock_status_id) || 0,
      image: product.image || '',
      manufacturer_id: parseInt(product.manufacturer_id) || 0,
      shipping: product.shipping === 1,
      price: parseFloat(product.price) || 0,
      points: parseInt(product.points) || 0,
      tax_class_id: parseInt(product.tax_class_id) || 0,
      date_available: product.date_available || new Date(),
      weight: parseFloat(product.weight) || 0,
      weight_class_id: parseInt(product.weight_class_id) || 0,
      length: parseFloat(product.length) || 0,
      width: parseFloat(product.width) || 0,
      height: parseFloat(product.height) || 0,
      length_class_id: parseInt(product.length_class_id) || 0,
      subtract: product.subtract === 1,
      minimum: parseInt(product.minimum) || 1,
      sort_order: parseInt(product.sort_order) || 0,
      status: product.status === 1,
      viewed: parseInt(product.viewed) || 0,
      date_added: product.date_added || new Date(),
      date_modified: product.date_modified || new Date(),
      
      // Embedded documents
      descriptions: descriptions.map(d => ({
        language_id: parseInt(d.language_id),
        name: d.name || '',
        description: d.description || '',
        tag: d.tag || '',
        meta_title: d.meta_title || '',
        meta_description: d.meta_description || '',
        meta_keyword: d.meta_keyword || ''
      })),
      
      categories: categories.map(c => parseInt(c.category_id)),
      stores: stores.map(s => parseInt(s.store_id)),
      
      additional_images: images.map(img => ({
        product_image_id: parseInt(img.product_image_id),
        image: img.image || '',
        sort_order: parseInt(img.sort_order) || 0
      })),
      
      attributes: processedAttributes,
      options: processedOptions,
      
      discounts: discounts.map(d => ({
        product_discount_id: parseInt(d.product_discount_id),
        quantity: parseInt(d.quantity) || 0,
        priority: parseInt(d.priority) || 0,
        price: parseFloat(d.price) || 0,
        date_start: d.date_start,
        date_end: d.date_end
      })),
      
      special_prices: specials.map(s => ({
        product_special_id: parseInt(s.product_special_id),
        customer_group_id: parseInt(s.customer_group_id),
        priority: parseInt(s.priority) || 0,
        price: parseFloat(s.price) || 0,
        date_start: s.date_start,
        date_end: s.date_end
      })),
      
      downloads: downloads.map(d => ({
        download_id: parseInt(d.download_id),
        name: d.name || '',
        filename: d.filename || '',
        mask: d.mask || '',
        remaining: parseInt(d.remaining) || 0
      })),
      
      related_products: related.map(r => parseInt(r.related_id)),
      
      migration_notes: []
    };
  } catch (err) {
    console.error(`Error processing product ${product.product_id}:`, err.message);
    throw err;
  }
};

// Main migration function
const migrateAllProducts = async () => {
  let mysql;
  const batchSize = 50; // Smaller batch size due to complexity
  const logFile = 'product_migration_log.txt';
  
  // Stats
  const stats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    failedProducts: []
  };
  
  try {
    // Connect to databases
    mysql = await connectDBs();
    
    // Drop existing products collection to start fresh
    try {
      await mongoose.connection.dropCollection('products');
      console.log('✅ Dropped existing products collection');
    } catch (err) {
      console.log('⚠️ No existing products collection to drop or error dropping:', err.message);
    }
    
    // Count total products
    const [countResult] = await mysql.execute('SELECT COUNT(*) as total FROM oc_product');
    const totalProducts = countResult[0].total;
    stats.total = totalProducts;
    
    console.log(`📊 Found ${totalProducts} products to migrate`);
    
    // Create log file
    await fs.writeFile(logFile, `Product Migration Log - ${new Date().toISOString()}\n\n`);
    
    // Calculate number of batches
    const batchCount = Math.ceil(totalProducts / batchSize);
    
    // Process in batches
    for (let batch = 0; batch < batchCount; batch++) {
      const offset = batch * batchSize;
      console.log(`⏳ Processing batch ${batch + 1}/${batchCount} (offset ${offset})`);
      
      // Get batch of products
      const [products] = await mysql.execute(
        'SELECT * FROM oc_product LIMIT ? OFFSET ?',
        [batchSize, offset]
      );
      
      // Process each product
      for (const product of products) {
        try {
          // Process product with all related data
          const productData = await processProduct(product, mysql);
          
          // Save to MongoDB
          const newProduct = new Product(productData);
          await newProduct.save();
          
          stats.succeeded++;
          
          // Log every 10 successful products
          if (stats.succeeded % 10 === 0) {
            console.log(`✅ Successfully migrated ${stats.succeeded} products so far`);
          }
          
        } catch (err) {
          // Log error
          const errorMsg = `Error migrating product ${product.product_id}: ${err.message}`;
          console.error(`❌ ${errorMsg}`);
          await fs.appendFile(logFile, `${errorMsg}\n`);
          
          stats.failed++;
          stats.failedProducts.push(product.product_id);
        }
      }
      
      console.log(`✅ Batch ${batch + 1}/${batchCount} complete`);
    }
    
    // Final stats
    console.log('\n📊 Migration Summary:');
    console.log(`Total products: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);
    
    if (stats.failedProducts.length > 0) {
      console.log(`Failed product IDs: ${stats.failedProducts.slice(0, 20).join(', ')}${stats.failedProducts.length > 20 ? '...' : ''}`);
    }
    
    await fs.appendFile(logFile, `\n\nMigration Summary:
Total products: ${stats.total}
Successfully migrated: ${stats.succeeded}
Failed: ${stats.failed}
Failed product IDs: ${stats.failedProducts.join(', ')}
`);
    
    console.log(`✅ Migration log written to ${logFile}`);
    
  } catch (err) {
    console.error('❌ Migration error:', err);
  } finally {
    // Close connections
    if (mysql) await mysql.end();
    await mongoose.disconnect();
  }
};

// Run migration
migrateAllProducts().catch(console.error);