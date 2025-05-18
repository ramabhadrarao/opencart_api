// services/migrations/migrateProductUploads.js
import fs from 'fs/promises';
import path from 'path';
import { connectMySQL } from '../../config/db.js';
import Product from '../../models/product.model.js';
import dotenv from 'dotenv';

dotenv.config();

// Path to store uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

export const migrateProductUploads = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking product options with uploads...');

  try {
    // Ensure upload directory exists
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      console.log(`✅ Upload directory confirmed: ${UPLOAD_DIR}`);
    } catch (err) {
      console.error(`❌ Error creating upload directory: ${err.message}`);
      return;
    }

    // Get all product options with upload_files content
    const [optionValues] = await mysql.execute(`
      SELECT pov.*, o.type, p.model as product_model
      FROM oc_product_option_value pov
      JOIN oc_product_option po ON pov.product_option_id = po.product_option_id
      JOIN oc_option o ON po.option_id = o.option_id
      JOIN oc_product p ON pov.product_id = p.product_id
      WHERE pov.uploaded_files != '' AND pov.uploaded_files IS NOT NULL
    `);

    console.log(`🔍 Found ${optionValues.length} product options with uploads`);

    if (optionValues.length === 0) {
      console.log('✅ No uploads to migrate');
      await mysql.end();
      return;
    }

    // Process each upload
    let successCount = 0;
    let errorCount = 0;

    for (const option of optionValues) {
      try {
        console.log(`📦 Processing upload for product_id: ${option.product_id}, option_value_id: ${option.option_value_id}`);
        
        // Parse the uploaded_files - format may vary based on OpenCart version
        // Common format is JSON or serialized PHP array
        let uploadedFiles = [];
        try {
          // Try to parse as JSON
          uploadedFiles = JSON.parse(option.uploaded_files);
        } catch (e) {
          // If not JSON, treat as comma-separated or other format
          uploadedFiles = option.uploaded_files.split(',').map(file => file.trim());
        }
        
        // If still not an array, make it one
        if (!Array.isArray(uploadedFiles)) {
          uploadedFiles = [uploadedFiles.toString()];
        }
        
        console.log(`📋 Found ${uploadedFiles.length} files to migrate`);
        
        // Process each file
        for (const fileRef of uploadedFiles) {
          if (!fileRef) continue;
          
          // Determine source path - might need adjustment based on OpenCart setup
          // OpenCart typically stores uploads in system/storage/upload/
          const sourcePath = path.join(process.cwd(), 'system', 'storage', 'upload', fileRef);
          
          // Create destination file name with product ID for uniqueness
          const fileName = `${option.product_id}_${option.option_value_id}_${path.basename(fileRef)}`;
          const destPath = path.join(UPLOAD_DIR, fileName);
          
          try {
            // Check if source file exists
            await fs.access(sourcePath);
            
            // Copy file to new location
            await fs.copyFile(sourcePath, destPath);
            
            console.log(`✅ Migrated file: ${fileRef} → ${fileName}`);
            
            // Update the MongoDB product record
            await Product.updateOne(
              { 
                product_id: option.product_id,
                'options.values.product_option_value_id': option.product_option_value_id
              },
              { 
                $set: { 
                  'options.$[opt].values.$[val].uploaded_file': fileName
                }
              },
              {
                arrayFilters: [
                  { 'opt.product_option_id': option.product_option_id },
                  { 'val.product_option_value_id': option.product_option_value_id }
                ]
              }
            );
            
            successCount++;
          } catch (err) {
            console.error(`❌ Error processing file ${fileRef}: ${err.message}`);
            errorCount++;
          }
        }
      } catch (err) {
        console.error(`❌ Error processing option: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log('\n📊 Upload Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} files`);
    console.log(`❌ Failed migrations: ${errorCount} files`);
    
    await mysql.end();
  } catch (err) {
    console.error(`❌ Migration error: ${err.message}`);
    await mysql.end();
  }
};