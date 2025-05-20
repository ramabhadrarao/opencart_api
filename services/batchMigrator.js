// services/batchMigrator.js
import { connectMySQL } from '../config/db.js';
import { connectMongoDB } from '../config/db.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Batch migration class for efficiently migrating MySQL to MongoDB
 */
export class BatchMigrator {
  /**
   * Create a new batch migrator
   * @param {Object} options Migration options
   * @param {string} options.tableName MySQL table name
   * @param {string} options.modelName Mongoose model name
   * @param {Function} options.transformer Function to transform MySQL rows to MongoDB documents
   * @param {string} options.idField Primary key field name in MySQL table
   * @param {number} options.batchSize Number of records to process in each batch
   */
  constructor(options) {
    this.tableName = options.tableName;
    this.modelName = options.modelName;
    this.transformer = options.transformer;
    this.idField = options.idField || 'id';
    this.batchSize = options.batchSize || 500;
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      startTime: null,
      endTime: null
    };
  }

  /**
   * Run the migration
   * @param {boolean} skipExisting Skip if target collection already has data
   * @param {string} whereClause Optional WHERE clause for filtering MySQL records
   */
  async run(skipExisting = true, whereClause = '') {
    this.stats.startTime = new Date();
    console.log(`🚀 Starting batch migration: ${this.tableName} → ${this.modelName}`);
    
    try {
      // Connect to databases if not already connected
      const mysql = await connectMySQL();
      await connectMongoDB();
      
      // Get Mongoose model
      const Model = mongoose.model(this.modelName);
      
      // Check if target collection already has data
      if (skipExisting) {
        const count = await Model.countDocuments();
        if (count > 0) {
          console.log(`✅ ${this.modelName} already has ${count} documents. Skipping migration.`);
          await mysql.end();
          this.stats.endTime = new Date();
          return this.stats;
        }
      }
      
      // Count total records
      const [countResult] = await mysql.execute(
        `SELECT COUNT(*) as total FROM ${this.tableName} ${whereClause}`
      );
      const totalRecords = countResult[0].total;
      
      console.log(`📊 Found ${totalRecords} records in ${this.tableName}`);
      
      // Calculate number of batches
      const batchCount = Math.ceil(totalRecords / this.batchSize);
      console.log(`⚙️ Using batch size ${this.batchSize} (${batchCount} batches)`);
      
      // Process in batches
      for (let batch = 0; batch < batchCount; batch++) {
        const offset = batch * this.batchSize;
        
        console.log(`⏳ Processing batch ${batch + 1}/${batchCount} (offset ${offset})`);
        
        // Fetch batch of records
        const [rows] = await mysql.execute(
          `SELECT * FROM ${this.tableName} ${whereClause} LIMIT ? OFFSET ?`,
          [this.batchSize, offset]
        );
        
        // Transform and prepare documents
        const documents = [];
        for (const row of rows) {
          try {
            const doc = await this.transformer(row, mysql);
            if (doc) {
              documents.push(doc);
            }
            this.stats.processed++;
          } catch (error) {
            console.error(`❌ Error transforming ${this.tableName} record:`, error.message);
            this.stats.failed++;
          }
        }
        
        // Insert documents in bulk
        if (documents.length > 0) {
          try {
            await Model.insertMany(documents, { ordered: false });
            this.stats.succeeded += documents.length;
          } catch (error) {
            if (error.name === 'BulkWriteError') {
              // Some documents may have been inserted even with errors
              this.stats.succeeded += error.result.nInserted;
              this.stats.failed += (documents.length - error.result.nInserted);
              console.error(`⚠️ Partial batch insert: ${error.result.nInserted}/${documents.length} inserted`);
            } else {
              console.error(`❌ Error inserting batch:`, error.message);
              this.stats.failed += documents.length;
            }
          }
        }
        
        // Progress update
        const progress = Math.round((offset + rows.length) / totalRecords * 100);
        console.log(`✅ Batch ${batch + 1}/${batchCount} complete (${progress}% total)`);
      }
      
      console.log(`🎉 Migration complete: ${this.tableName} → ${this.modelName}`);
      console.log(`📊 Processed: ${this.stats.processed}, Succeeded: ${this.stats.succeeded}, Failed: ${this.stats.failed}`);
      
      await mysql.end();
    } catch (error) {
      console.error(`❌ Migration error:`, error.message);
      this.stats.failed += (this.stats.processed - this.stats.succeeded);
    }
    
    this.stats.endTime = new Date();
    const durationMs = this.stats.endTime - this.stats.startTime;
    const durationSec = Math.round(durationMs / 1000);
    console.log(`⏱️ Migration took ${durationSec} seconds`);
    
    return this.stats;
  }
}