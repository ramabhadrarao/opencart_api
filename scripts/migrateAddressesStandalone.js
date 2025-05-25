// scripts/debugAddressMigration.js
import { connectMongoDB, connectMySQL } from '../config/db.js';
import Address from '../models/address.model.js';
import mongoose from 'mongoose';

console.log('🚀 Starting Address Migration Debug Script...');

async function debugAddressMigration() {
  let mysql = null;
  
  try {
    console.log('📡 Step 1: Connecting to databases...');
    
    // Connect to MongoDB
    try {
      await connectMongoDB();
      console.log('✅ MongoDB connected successfully');
    } catch (mongoError) {
      console.error('❌ MongoDB connection failed:', mongoError.message);
      return;
    }
    
    // Connect to MySQL
    try {
      mysql = await connectMySQL();
      console.log('✅ MySQL connected successfully');
    } catch (mysqlError) {
      console.error('❌ MySQL connection failed:', mysqlError.message);
      return;
    }
    
    console.log('\n📊 Step 2: Checking source data...');
    
    // Check MySQL addresses
    try {
      const [addressCount] = await mysql.execute('SELECT COUNT(*) as count FROM oc_address');
      console.log(`✅ MySQL oc_address table: ${addressCount[0].count.toLocaleString()} records`);
      
      if (addressCount[0].count === 0) {
        console.log('⚠️ No addresses to migrate - oc_address table is empty');
        return;
      }
      
      // Show sample data
      const [sampleAddresses] = await mysql.execute('SELECT * FROM oc_address LIMIT 3');
      console.log('\n📋 Sample MySQL addresses:');
      sampleAddresses.forEach((addr, index) => {
        console.log(`   ${index + 1}. ID: ${addr.address_id}, Customer: ${addr.customer_id}, Address: ${addr.address_1}`);
      });
      
    } catch (mysqlError) {
      console.error('❌ Error checking MySQL data:', mysqlError.message);
      return;
    }
    
    console.log('\n🗄️ Step 3: Checking MongoDB collection...');
    
    // Check current MongoDB addresses
    try {
      const currentCount = await Address.countDocuments();
      console.log(`📊 Current addresses in MongoDB: ${currentCount.toLocaleString()}`);
      
      if (currentCount > 0) {
        console.log('⚠️ MongoDB addresses collection already has data');
        console.log('🧹 Clearing existing data...');
        const deleteResult = await Address.deleteMany({});
        console.log(`✅ Cleared ${deleteResult.deletedCount} existing addresses`);
      }
    } catch (mongoError) {
      console.error('❌ Error checking MongoDB:', mongoError.message);
      return;
    }
    
    console.log('\n🚀 Step 4: Starting migration...');
    
    // Get all addresses
    const [addresses] = await mysql.execute(`
      SELECT 
        address_id,
        customer_id,
        firstname,
        lastname,
        company,
        address_1,
        address_2,
        city,
        postcode,
        country_id,
        zone_id,
        custom_field
      FROM oc_address 
      ORDER BY address_id
    `);
    
    console.log(`📦 Processing ${addresses.length.toLocaleString()} addresses...`);
    
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    
    // Process in smaller batches
    const batchSize = 50;
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addresses.length / batchSize)} (${batch.length} addresses)...`);
      
      for (const addressRow of batch) {
        try {
          processed++;
          
          // Create new address document
          const address = new Address({
            address_id: addressRow.address_id,
            customer_id: addressRow.customer_id,
            firstname: addressRow.firstname || '',
            lastname: addressRow.lastname || '',
            company: addressRow.company || '',
            address_1: addressRow.address_1 || '',
            address_2: addressRow.address_2 || '',
            city: addressRow.city || '',
            postcode: addressRow.postcode || '',
            country_id: addressRow.country_id || 0,
            zone_id: addressRow.zone_id || 0,
            custom_field: addressRow.custom_field || ''
          });
          
          await address.save();
          succeeded++;
          
          // Show progress every 500 records
          if (succeeded % 500 === 0) {
            console.log(`   ✅ Progress: ${succeeded}/${addresses.length} (${((succeeded / addresses.length) * 100).toFixed(1)}%)`);
          }
          
        } catch (error) {
          failed++;
          console.error(`   ❌ Failed address ${addressRow.address_id}: ${error.message}`);
          
          // Stop if too many failures
          if (failed > 10) {
            console.error('❌ Too many failures, stopping migration');
            break;
          }
        }
      }
      
      // Progress update per batch
      console.log(`   ✅ Batch completed: ${succeeded} success, ${failed} failed`);
    }
    
    console.log('\n📊 Step 5: Migration Results:');
    console.log(`   📦 Total processed: ${processed.toLocaleString()}`);
    console.log(`   ✅ Successfully migrated: ${succeeded.toLocaleString()}`);
    console.log(`   ❌ Failed: ${failed.toLocaleString()}`);
    
    if (failed > 0) {
      console.log('\n⚠️ Some addresses failed to migrate. Check the error messages above.');
    }
    
    console.log('\n🔍 Step 6: Verification...');
    
    // Verify the migration
    const finalCount = await Address.countDocuments();
    console.log(`📊 Final MongoDB count: ${finalCount.toLocaleString()}`);
    
    const [mysqlFinalCount] = await mysql.execute('SELECT COUNT(*) as count FROM oc_address');
    const mysqlCount = mysqlFinalCount[0].count;
    
    console.log(`📊 MySQL source count: ${mysqlCount.toLocaleString()}`);
    
    if (finalCount === mysqlCount) {
      console.log('✅ MIGRATION SUCCESSFUL - Perfect match!');
    } else {
      console.log(`❌ MIGRATION INCOMPLETE - Missing ${mysqlCount - finalCount} addresses`);
    }
    
    // Show sample migrated data
    console.log('\n📋 Sample migrated addresses:');
    const sampleMigrated = await Address.find().limit(3).lean();
    sampleMigrated.forEach((addr, index) => {
      console.log(`   ${index + 1}. ID: ${addr.address_id}, Customer: ${addr.customer_id}, Address: ${addr.address_1}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('\n🧹 Closing database connections...');
    
    if (mysql) {
      await mysql.end();
      console.log('✅ MySQL connection closed');
    }
    
    await mongoose.disconnect();
    console.log('✅ MongoDB connection closed');
    
    console.log('\n🏁 Address migration debug script completed');
  }
}

// Run the debug script
debugAddressMigration().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});