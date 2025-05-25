// scripts/cleanupDatabase.js
import { connectMongoDB } from '../config/db.js';
import mongoose from 'mongoose';

async function cleanupDatabase() {
  console.log('🧹 Cleaning up MongoDB database...\n');
  
  try {
    await connectMongoDB();
    
    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`📊 Found ${collections.length} collections\n`);
    
    // Drop all collections (optional - uncomment if needed)
    /*
    for (const collection of collections) {
      try {
        await db.dropCollection(collection.name);
        console.log(`✅ Dropped collection: ${collection.name}`);
      } catch (error) {
        console.log(`⚠️  Could not drop ${collection.name}: ${error.message}`);
      }
    }
    */
    
    // Drop all indexes to clean up duplicates
    for (const collection of collections) {
      try {
        await db.collection(collection.name).dropIndexes();
        console.log(`✅ Dropped indexes for: ${collection.name}`);
      } catch (error) {
        console.log(`⚠️  Could not drop indexes for ${collection.name}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Database cleanup completed!');
    console.log('💡 You can now run the migration check again');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDatabase();
}

export default cleanupDatabase;