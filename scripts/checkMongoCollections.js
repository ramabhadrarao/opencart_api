// scripts/checkMongoCollections.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const run = async () => {
  console.log('🔄 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected\n');
    
    const db = mongoose.connection;
    
    // Get all collections
    const collections = await db.db.listCollections().toArray();
    
    console.log(`📊 MongoDB Collections in ${db.name}:\n`);
    
    // Check each collection
    for (const collection of collections) {
      const count = await db.db.collection(collection.name).countDocuments();
      console.log(`${collection.name}: ${count} documents`);
    }
    
    console.log('\n🏁 Check completed');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    // Close connection
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();