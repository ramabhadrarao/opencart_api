// scripts/fullCustomerMigration.js
import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import Customer from '../models/customer.model.js'; // Import Customer model directly

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

// Helper function to process customer data
const processCustomer = (customer, addresses, wishlist = []) => {
  // Process addresses, handling null values
  const processedAddresses = addresses.map(address => ({
    address_id: parseInt(address.address_id) || 0,
    firstname: address.firstname || '',
    lastname: address.lastname || '',
    company: address.company || '',
    address_1: address.address_1 || '',
    address_2: address.address_2 || '',
    city: address.city || '',
    postcode: address.postcode || '',
    country_id: parseInt(address.country_id) || 0,
    zone_id: parseInt(address.zone_id) || 0,
    custom_field: tryParseJson(address.custom_field)
  }));
  
  // Process wishlist
  const processedWishlist = wishlist.map(item => parseInt(item.product_id));
  
  // Determine address_id
  let addressId = parseInt(customer.address_id) || 0;
  if (addressId === 0 && processedAddresses.length > 0) {
    addressId = processedAddresses[0].address_id;
  }
  
  // Process customer data, with default values for null fields
  return {
    customer_id: parseInt(customer.customer_id),
    imported_id: parseInt(customer.customer_id),
    customer_group_id: parseInt(customer.customer_group_id) || 1,
    store_id: parseInt(customer.store_id) || 0,
    language_id: parseInt(customer.language_id) || 1,
    firstname: customer.firstname || '',
    lastname: customer.lastname || '',
    email: customer.email || `customer_${customer.customer_id}@example.com`, // Fallback email
    telephone: customer.telephone || '',
    fax: customer.fax || '',
    password: customer.password || '',
    salt: customer.salt || '',
    cart: tryParseJson(customer.cart),
    wishlist: processedWishlist,
    newsletter: customer.newsletter === 1,
    address_id: addressId,
    custom_field: tryParseJson(customer.custom_field),
    ip: customer.ip || '',
    status: customer.status === 1,
    safe: customer.safe === 1,
    token: customer.token || '',
    code: customer.code || '',
    date_added: customer.date_added || new Date(),
    addresses: processedAddresses,
    migration_notes: []
  };
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

// Main migration function
const migrateAllCustomers = async () => {
  let mysql;
  const batchSize = 500;
  const logFile = 'customer_migration_log.txt';
  
  // Stats
  const stats = {
    total: 0,
    succeeded: 0,
    failed: 0,
    duplicates: 0,
    addressIssues: 0,
    customerIds: []
  };
  
  try {
    // Connect to databases
    mysql = await connectDBs();
    
    // Drop existing customers collection to start fresh
    try {
      await mongoose.connection.dropCollection('customers');
      console.log('✅ Dropped existing customers collection');
    } catch (err) {
      console.log('⚠️ No existing customers collection to drop');
    }
    
    // Count total customers
    const [countResult] = await mysql.execute('SELECT COUNT(*) as total FROM oc_customer');
    const totalCustomers = countResult[0].total;
    stats.total = totalCustomers;
    
    console.log(`📊 Found ${totalCustomers} customers to migrate`);
    
    // Create log file
    await fs.writeFile(logFile, `Customer Migration Log - ${new Date().toISOString()}\n\n`);
    
    // Calculate number of batches
    const batchCount = Math.ceil(totalCustomers / batchSize);
    
    // Process in batches
    for (let batch = 0; batch < batchCount; batch++) {
      const offset = batch * batchSize;
      console.log(`⏳ Processing batch ${batch + 1}/${batchCount} (offset ${offset})`);
      
      // Get batch of customers
      const [customers] = await mysql.execute(
        'SELECT * FROM oc_customer LIMIT ? OFFSET ?',
        [batchSize, offset]
      );
      
      // Process each customer
      for (const customer of customers) {
        try {
          // Get addresses for this customer
          const [addresses] = await mysql.execute(
            'SELECT * FROM oc_address WHERE customer_id = ?',
            [customer.customer_id]
          );
          
          // Get wishlist
          const [wishlist] = await mysql.execute(
            'SELECT product_id FROM oc_customer_wishlist WHERE customer_id = ?',
            [customer.customer_id]
          );
          
          // Process customer data
          const customerData = processCustomer(customer, addresses, wishlist);
          
          // Add migration notes if needed
          if (!customer.email) {
            customerData.migration_notes.push('Missing email, generated placeholder');
          }
          
          if (addresses.length === 0) {
            customerData.migration_notes.push('No addresses found');
            stats.addressIssues++;
          }
          
          // Save to MongoDB
          const newCustomer = new Customer(customerData);
          await newCustomer.save();
          
          stats.succeeded++;
          stats.customerIds.push(customer.customer_id);
          
        } catch (err) {
          // Log error
          const errorMsg = `Error migrating customer ${customer.customer_id}: ${err.message}`;
          console.error(`❌ ${errorMsg}`);
          await fs.appendFile(logFile, `${errorMsg}\n`);
          
          // Check for duplicate key error
          if (err.code === 11000) {
            stats.duplicates++;
            
            // Try to determine which field caused the duplicate
            const dupField = err.message.includes('email') ? 'email' : 
                            err.message.includes('customer_id') ? 'customer_id' : 'unknown';
            
            await fs.appendFile(logFile, `  Duplicate ${dupField}: ${customer.email || 'N/A'}\n`);
          }
          
          stats.failed++;
        }
      }
      
      console.log(`✅ Batch ${batch + 1}/${batchCount} complete`);
    }
    
    // Final stats
    console.log('\n📊 Migration Summary:');
    console.log(`Total customers: ${stats.total}`);
    console.log(`Successfully migrated: ${stats.succeeded}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Duplicates: ${stats.duplicates}`);
    console.log(`Address issues: ${stats.addressIssues}`);
    
    await fs.appendFile(logFile, `\n\nMigration Summary:
Total customers: ${stats.total}
Successfully migrated: ${stats.succeeded}
Failed: ${stats.failed}
Duplicates: ${stats.duplicates}
Address issues: ${stats.addressIssues}
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
migrateAllCustomers().catch(console.error);