// scripts/verifyUploadedFiles.js
import { connectMongoDB, connectMySQL } from '../config/db.js';
import Product from '../models/product.model.js';
import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';

class FileVerificationService {
  constructor() {
    this.mysql = null;
    this.uploadBaseDir = process.env.UPLOAD_DIR || './uploads';
    this.stats = {
      total_references: 0,
      files_found: 0,
      files_missing: 0,
      empty_references: 0
    };
    this.missingFiles = [];
    this.foundFiles = [];
  }

  async initialize() {
    await connectMongoDB();
    this.mysql = await connectMySQL();
    
    // Ensure upload directory exists
    try {
      await fs.mkdir(this.uploadBaseDir, { recursive: true });
    } catch (error) {
      console.log('Upload directory exists or error creating:', error.message);
    }
    
    console.log('✅ Database connections and upload directory ready');
  }

  async verifyProductOptionFiles() {
    console.log('\n📁 Verifying Product Option Uploaded Files...\n');
    console.log('=' .repeat(60));
    
    // Get all products with options that have uploaded files
    const products = await Product.find({
      'options.values.uploaded_file': { $exists: true, $ne: '' }
    });
    
    console.log(`📊 Found ${products.length} products with uploaded files to verify\n`);
    
    for (const product of products) {
      console.log(`\n🔍 Checking Product ID: ${product.product_id}`);
      
      for (const option of product.options) {
        if (option.values && option.values.length > 0) {
          for (const value of option.values) {
            if (value.uploaded_file && value.uploaded_file.trim() !== '') {
              await this.checkSingleFile(
                product.product_id,
                option.name,
                value.name,
                value.uploaded_file.trim(),
                value.product_option_value_id
              );
            }
          }
        }
      }
    }
    
    await this.generateReport();
  }

  async checkSingleFile(productId, optionName, valueName, fileName, optionValueId) {
    this.stats.total_references++;
    
    if (!fileName || fileName === '') {
      this.stats.empty_references++;
      return;
    }
    
    // Common upload paths to check
    const possiblePaths = [
      path.join(this.uploadBaseDir, fileName),
      path.join(this.uploadBaseDir, 'products', fileName),
      path.join(this.uploadBaseDir, 'options', fileName),
      path.join(this.uploadBaseDir, productId.toString(), fileName),
      path.join(process.cwd(), 'system', 'storage', 'upload', fileName),
      path.join(process.cwd(), 'image', 'catalog', fileName),
      path.join(process.cwd(), 'upload', fileName)
    ];
    
    let fileFound = false;
    let foundPath = null;
    
    for (const filePath of possiblePaths) {
      try {
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          fileFound = true;
          foundPath = filePath;
          break;
        }
      } catch (error) {
        // File doesn't exist at this path, continue checking
      }
    }
    
    if (fileFound) {
      this.stats.files_found++;
      const fileStats = await fs.stat(foundPath);
      
      this.foundFiles.push({
        product_id: productId,
        option_name: optionName,
        value_name: valueName,
        option_value_id: optionValueId,
        file_name: fileName,
        file_path: foundPath,
        file_size: fileStats.size,
        last_modified: fileStats.mtime
      });
      
      console.log(`   ✅ ${fileName} (${this.formatBytes(fileStats.size)})`);
    } else {
      this.stats.files_missing++;
      
      this.missingFiles.push({
        product_id: productId,
        option_name: optionName,
        value_name: valueName,
        option_value_id: optionValueId,
        file_name: fileName,
        searched_paths: possiblePaths
      });
      
      console.log(`   ❌ ${fileName} (NOT FOUND)`);
    }
  }

  async generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 FILE VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total file references: ${this.stats.total_references}`);
    console.log(`   Files found: ${this.stats.files_found}`);
    console.log(`   Files missing: ${this.stats.files_missing}`);
    console.log(`   Empty references: ${this.stats.empty_references}`);
    
    const successRate = this.stats.total_references > 0 
      ? ((this.stats.files_found / this.stats.total_references) * 100).toFixed(2)
      : 0;
    
    console.log(`   Success rate: ${successRate}%`);
    
    // Generate detailed reports
    await this.generateMissingFilesReport();
    await this.generateFoundFilesReport();
    await this.generateFileMovementScript();
    
    console.log('\n📁 Report files generated:');
    console.log('   - missing-files-report.json');
    console.log('   - found-files-report.json');
    console.log('   - file-movement-script.sh');
  }

  async generateMissingFilesReport() {
    const report = {
      generated_at: new Date().toISOString(),
      total_missing: this.stats.files_missing,
      missing_files: this.missingFiles
    };
    
    await fs.writeFile(
      'missing-files-report.json',
      JSON.stringify(report, null, 2)
    );
    
    // Also generate a simple CSV for easy review
    let csv = 'Product ID,Option Name,Value Name,File Name,Option Value ID\n';
    for (const file of this.missingFiles) {
      csv += `${file.product_id},"${file.option_name}","${file.value_name}","${file.file_name}",${file.option_value_id}\n`;
    }
    
    await fs.writeFile('missing-files.csv', csv);
  }

  async generateFoundFilesReport() {
    const report = {
      generated_at: new Date().toISOString(),
      total_found: this.stats.files_found,
      total_size: this.foundFiles.reduce((sum, file) => sum + file.file_size, 0),
      found_files: this.foundFiles
    };
    
    await fs.writeFile(
      'found-files-report.json',
      JSON.stringify(report, null, 2)
    );
  }

  async generateFileMovementScript() {
    let script = '#!/bin/bash\n';
    script += '# Auto-generated file movement script\n';
    script += '# This script moves found files to a standardized upload directory\n\n';
    script += `UPLOAD_DIR="${this.uploadBaseDir}"\n`;
    script += 'mkdir -p "$UPLOAD_DIR"\n\n';
    
    for (const file of this.foundFiles) {
      const targetPath = path.join(this.uploadBaseDir, file.file_name);
      script += `# Product ${file.product_id} - ${file.option_name}: ${file.value_name}\n`;
      script += `cp "${file.file_path}" "${targetPath}"\n`;
      script += `echo "Copied ${file.file_name}"\n\n`;
    }
    
    script += 'echo "File movement completed!"\n';
    
    await fs.writeFile('file-movement-script.sh', script);
    
    // Make the script executable (on Unix systems)
    try {
      await fs.chmod('file-movement-script.sh', 0o755);
    } catch (error) {
      console.log('Note: Could not make script executable (Windows?)');
    }
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async verifyMySQLOptionFiles() {
    console.log('\n🔍 Cross-checking with MySQL data...\n');
    
    const [rows] = await this.mysql.execute(`
      SELECT 
        pov.product_id,
        pov.product_option_value_id,
        pov.uploaded_files,
        od.name as option_name,
        ovd.name as value_name
      FROM oc_product_option_value pov
      LEFT JOIN oc_product_option po ON pov.product_option_id = po.product_option_id
      LEFT JOIN oc_option_description od ON po.option_id = od.option_id AND od.language_id = 1
      LEFT JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id AND ovd.language_id = 1
      WHERE pov.uploaded_files IS NOT NULL 
      AND pov.uploaded_files != ''
      ORDER BY pov.product_id, pov.product_option_value_id
    `);
    
    console.log(`📊 Found ${rows.length} file references in MySQL\n`);
    
    const mysqlFiles = [];
    const mongoFiles = new Set();
    
    // Collect MongoDB files for comparison
    const products = await Product.find({
      'options.values.uploaded_file': { $exists: true, $ne: '' }
    });
    
    for (const product of products) {
      for (const option of product.options) {
        if (option.values) {
          for (const value of option.values) {
            if (value.uploaded_file && value.uploaded_file.trim() !== '') {
              mongoFiles.add(`${product.product_id}-${value.product_option_value_id}-${value.uploaded_file.trim()}`);
            }
          }
        }
      }
    }
    
    // Check MySQL files
    for (const row of rows) {
      const key = `${row.product_id}-${row.product_option_value_id}-${row.uploaded_files}`;
      mysqlFiles.push({
        product_id: row.product_id,
        option_value_id: row.product_option_value_id,
        file_name: row.uploaded_files,
        option_name: row.option_name,
        value_name: row.value_name,
        migrated_to_mongo: mongoFiles.has(key)
      });
    }
    
    const notMigrated = mysqlFiles.filter(f => !f.migrated_to_mongo);
    
    console.log(`📊 Migration verification:`);
    console.log(`   MySQL file references: ${mysqlFiles.length}`);
    console.log(`   MongoDB file references: ${mongoFiles.size}`);
    console.log(`   Not migrated: ${notMigrated.length}`);
    
    if (notMigrated.length > 0) {
      console.log('\n❌ Files not migrated to MongoDB:');
      for (const file of notMigrated.slice(0, 10)) {
        console.log(`   Product ${file.product_id}: ${file.file_name}`);
      }
      if (notMigrated.length > 10) {
        console.log(`   ... and ${notMigrated.length - 10} more`);
      }
      
      // Save not migrated files report
      await fs.writeFile(
        'not-migrated-files.json',
        JSON.stringify({ total: notMigrated.length, files: notMigrated }, null, 2)
      );
    }
  }

  async cleanup() {
    if (this.mysql) {
      await this.mysql.end();
    }
    await mongoose.disconnect();
    console.log('🧹 Database connections closed');
  }
}

async function main() {
  console.log('🔍 OpenCart Uploaded Files Verification Tool');
  console.log('============================================\n');
  console.log(`📅 Started at: ${new Date().toLocaleString()}\n`);
  
  const verifier = new FileVerificationService();
  
  try {
    await verifier.initialize();
    
    // Verify files from MongoDB
    await verifier.verifyProductOptionFiles();
    
    // Cross-check with MySQL
    await verifier.verifyMySQLOptionFiles();
    
    console.log('\n✅ File verification completed!');
    console.log('\n💡 Next steps:');
    console.log('   1. Review missing-files-report.json for missing files');
    console.log('   2. Run file-movement-script.sh to organize found files');
    console.log('   3. Manually locate and place missing files in upload directory');
    console.log('   4. Re-run verification to confirm all files are available');
    
  } catch (error) {
    console.error('❌ Error during file verification:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await verifier.cleanup();
  }
}

// Handle command line usage
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export default FileVerificationService;