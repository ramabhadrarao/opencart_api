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
   * @param {boolean} options.continueOnError Whether to continue processing on error
   */
  constructor(options) {
    this.tableName = options.tableName;
    this.modelName = options.modelName;
    this.transformer = options.transformer;
    this.idField = options.idField || 'id';
    this.batchSize = options.batchSize || 500;
    this.continueOnError = options.continueOnError !== undefined ? options.continueOnError : true;
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      failedIds: [],
      startTime: null,
      endTime: null
    };
  }

  /**
   * Run the migration
   * @param {boolean} skipExisting Skip if target collection already has data
   * @param {string} whereClause Optional WHERE clause for filtering MySQL records
   * @returns {Promise<Object>} Migration statistics
   */
  async run(skipExisting = true, whereClause = '') {
    this.stats.startTime = new Date();
    console.log(`🚀 Starting batch migration: ${this.tableName} → ${this.modelName}`);
    
    let mysql;
    
    try {
      // Connect to databases if not already connected
      mysql = await connectMySQL();
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
        const batchErrors = [];
        
        for (const row of rows) {
          try {
            const doc = await this.transformer(row, mysql);
            if (doc) {
              documents.push(doc);
            }
            this.stats.processed++;
          } catch (error) {
            this.stats.failed++;
            this.stats.failedIds.push(row[this.idField]);
            batchErrors.push({
              id: row[this.idField],
              error: error.message
            });
            
            console.error(`❌ Error transforming ${this.tableName} record ${row[this.idField]}:`, error.message);
            
            // Stop processing if continueOnError is false
            if (!this.continueOnError) {
              throw new Error(`Failed to transform record ${row[this.idField]}: ${error.message}`);
            }
          }
        }
        
        // Insert documents in bulk if any processed successfully
        if (documents.length > 0) {
          try {
            await Model.insertMany(documents, { ordered: false });
            this.stats.succeeded += documents.length;
          } catch (error) {
            if (error.name === 'BulkWriteError') {
              // Some documents may have been inserted even with errors
              this.stats.succeeded += error.result.nInserted || 0;
              this.stats.failed += (documents.length - (error.result.nInserted || 0));
              
              // Add failed IDs if available
              if (error.writeErrors) {
                for (const writeError of error.writeErrors) {
                  const index = writeError.index;
                  if (index >= 0 && index < documents.length) {
                    const doc = documents[index];
                    this.stats.failedIds.push(doc[this.idField]);
                    batchErrors.push({
                      id: doc[this.idField],
                      error: writeError.errmsg
                    });
                  }
                }
              }
              
              console.error(`⚠️ Partial batch insert: ${error.result.nInserted || 0}/${documents.length} inserted`);
            } else {
              this.stats.failed += documents.length;
              console.error(`❌ Error inserting batch:`, error.message);
              
              // Stop processing if continueOnError is false
              if (!this.continueOnError) {
                throw error;
              }
            }
          }
        }
        
        // Log batch errors summary if any
        if (batchErrors.length > 0) {
          console.error(`⚠️ Batch ${batch + 1} had ${batchErrors.length} errors`);
        }
        
        // Progress update
        const progress = Math.round((offset + rows.length) / totalRecords * 100);
        console.log(`✅ Batch ${batch + 1}/${batchCount} complete (${progress}% total)`);
      }
      
      console.log(`🎉 Migration complete: ${this.tableName} → ${this.modelName}`);
      console.log(`📊 Processed: ${this.stats.processed}, Succeeded: ${this.stats.succeeded}, Failed: ${this.stats.failed}`);
      
      if (this.stats.failed > 0) {
        console.error(`⚠️ Failed IDs: ${this.stats.failedIds.slice(0, 10).join(', ')}${this.stats.failedIds.length > 10 ? '...' : ''}`);
      }
      
    } catch (error) {
      console.error(`❌ Migration error:`, error.message);
      this.stats.failed += (this.stats.processed - this.stats.succeeded);
      throw error;
    } finally {
      if (mysql) {
        await mysql.end();
      }
      
      this.stats.endTime = new Date();
      const durationMs = this.stats.endTime - this.stats.startTime;
      const durationSec = Math.round(durationMs / 1000);
      console.log(`⏱️ Migration took ${durationSec} seconds`);
    }
    
    return this.stats;
  }
  
  /**
   * Get IDs of failed records
   * @returns {Array<number|string>} Array of failed record IDs
   */
  getFailedIds() {
    return this.stats.failedIds;
  }
}