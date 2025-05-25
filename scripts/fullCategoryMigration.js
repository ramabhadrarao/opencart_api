// scripts/fullCategoryMigration.js
import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs/promises';
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

// Process a single category with all related data
const processCategory = async (category, mysql) => {
  try {
    // Get descriptions
    const [descriptions] = await mysql.execute(
      'SELECT * FROM oc_category_description WHERE category_id = ?',
      [category.category_id]
    );
    
    // Get path
    const [paths] = await mysql.execute(
      'SELECT * FROM oc_category_path WHERE category_id = ? ORDER BY level',
      [category.category_id]
    );
    
    // Get stores
    const [stores] = await mysql.execute(
      'SELECT store_id FROM oc_category_to_store WHERE category_id = ?',
      [category.category_id]
    );
    
    // Prepare the category object
    return {
      category_id: parseInt(category.category_id),
      parent_id: parseInt(category.parent_id) || 0,
      image: category.image || '',
      top: category.top === 1,
      column: parseInt(category.column) || 1,
      sort_order: parseInt(category.sort_order) || 0,
      status: category.status === 1,
      date_added: category.date_added || new Date(),
      date_modified: category.date_modified || new Date(),
      
      // Descriptions
      descriptions: descriptions.map(d => ({
        language_id: parseInt(d.language_id),
        name: d.name || '',
        description: d.description || '',
        meta_title: d.meta_title || '',
        meta_description: d.meta_description || '',
        meta_keyword: d.meta_keyword || ''
      })),
      
      // Path for hierarchical structure
      path: paths.map(p => parseInt(p.path_id)),
      
      // Stores
      stores: stores.map(s => parseInt(s.store_id)),
      
      // Migration info
      migration_notes: []
    };
  } catch (err) {
    console.error(`Error processing category ${category.category_id}:`, err.message);
    throw err;
  }
};

// Main migration function
const migrateAllCategories = async () => {
  let mysql;
  const logFile = 'category_migration_log.txt';
  
  // Stats
  const stats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    failedCategories: []
  };
  
  try {
    // Connect to databases
    mysql = await connectDBs();
    
    // Drop existing categories collection to start fresh
    try {
      await mongoose.connection.dropCollection('categories');
      console.log('✅ Dropped existing categories collection');
    } catch (err) {
      console.log('⚠️ No existing categories collection to drop');
    }
    
    // Count total categories
    const [countResult] = await mysql.execute('SELECT COUNT(*) as total FROM oc_category');
    const totalCategories = countResult[0].total;
    stats.total = totalCategories;
    
    console.log(`📊 Found ${totalCategories} categories to migrate`);
    
    // Create log file
    await fs.writeFile(logFile, `Category Migration Log - ${new Date().toISOString()}\n\n`);
    
    // Get all categories (no need for batching as there usually aren't many)
    const [categories] = await mysql.execute('SELECT * FROM oc_category ORDER BY category_id');
    
    // Process each category
    for (const category of categories) {
      try {
        // Process category with all related data
        const categoryData = await processCategory(category, mysql);
        
        // Save to MongoDB
        const newCategory = new Category(categoryData);
        await newCategory.save();
        
        stats.succeeded++;
        
        console.log(`✅ Successfully migrated category ${category.category_id}`);
        
      } catch (err) {
        // Log error
        const errorMsg = `Error migrating category ${category.category_id}: ${err.message}`;
        console.error(`❌ ${errorMsg}`);
        await fs.appendFile(logFile, `${errorMsg}\n`);
        
        stats.failed++;
        stats.failedCategories.push(category.category_id);
      }
    }
    
    // Final stats
    console.log('\n📊 Migration Summary:');
    console.log(`Total categories: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);
    
    if (stats.failedCategories.length > 0) {
      console.log(`Failed category IDs: ${stats.failedCategories.join(', ')}`);
    }
    
    await fs.appendFile(logFile, `\n\nMigration Summary:
Total categories: ${stats.total}
Successfully migrated: ${stats.succeeded}
Failed: ${stats.failed}
Failed category IDs: ${stats.failedCategories.join(', ')}
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
migrateAllCategories().catch(console.error);