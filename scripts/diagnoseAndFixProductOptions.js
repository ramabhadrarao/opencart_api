// scripts/diagnoseAndFixProductOptions.js
import { connectMongoDB } from '../config/db.js';
import mongoose from 'mongoose';

class ProductOptionsDiagnostic {
  constructor() {
    this.stats = {
      total_products: 0,
      products_with_options: 0,
      string_options: 0,
      array_options: 0,
      null_options: 0,
      fixed: 0,
      errors: 0
    };
    this.problematicProducts = [];
  }

  async initialize() {
    await connectMongoDB();
    console.log('✅ Connected to MongoDB');
  }

  async diagnoseAllProducts() {
    console.log('🔍 Diagnosing all products for options data type issues...\n');
    
    try {
      const db = mongoose.connection.db;
      const collection = db.collection('products');
      
      // Get total count
      this.stats.total_products = await collection.countDocuments();
      console.log(`📊 Total products in database: ${this.stats.total_products}`);
      
      // Find products with options field
      const cursor = collection.find({ options: { $exists: true } });
      
      console.log('\n🔍 Analyzing each product...\n');
      
      for await (const product of cursor) {
        this.stats.products_with_options++;
        
        const productId = product.product_id;
        const optionsType = typeof product.options;
        const isArray = Array.isArray(product.options);
        
        console.log(`Product ID ${productId}: options type = ${optionsType}, isArray = ${isArray}`);
        
        if (product.options === null || product.options === undefined) {
          this.stats.null_options++;
        } else if (typeof product.options === 'string') {
          this.stats.string_options++;
          this.problematicProducts.push({
            _id: product._id,
            product_id: productId,
            issue: 'string_options',
            options_preview: product.options.substring(0, 100)
          });
          console.log(`   ❌ PROBLEM: Options is string instead of array`);
          console.log(`   Preview: ${product.options.substring(0, 100)}...`);
        } else if (Array.isArray(product.options)) {
          this.stats.array_options++;
          console.log(`   ✅ OK: Options is properly an array with ${product.options.length} items`);
        } else {
          console.log(`   ⚠️  UNEXPECTED: Options type is ${optionsType}`);
        }
      }
      
      await this.generateDiagnosticReport();
      
      if (this.stats.string_options > 0) {
        console.log('\n🔧 Found products with string options. Attempting to fix...');
        await this.fixStringOptions();
      }
      
    } catch (error) {
      console.error('❌ Error during diagnosis:', error.message);
      this.stats.errors++;
    }
  }

  async fixStringOptions() {
    console.log(`\n🔧 Fixing ${this.problematicProducts.length} products with string options...\n`);
    
    const db = mongoose.connection.db;
    const collection = db.collection('products');
    
    for (const product of this.problematicProducts) {
      try {
        console.log(`🔧 Fixing Product ID: ${product.product_id}`);
        
        // Get the full product document
        const fullProduct = await collection.findOne({ _id: product._id });
        
        let parsedOptions = [];
        
        if (typeof fullProduct.options === 'string') {
          // Try to parse the string as JSON
          try {
            // First, try direct JSON parse
            parsedOptions = JSON.parse(fullProduct.options);
            console.log(`   ✅ Successfully parsed JSON for Product ${product.product_id}`);
          } catch (jsonError) {
            console.log(`   ⚠️  JSON parse failed, trying alternative methods...`);
            
            // Try to fix common string format issues
            let optionsString = fullProduct.options
              .replace(/ObjectId\("([^"]+)"\)/g, '"$1"') // Fix ObjectId format
              .replace(/ISODate\("([^"]+)"\)/g, '"$1"') // Fix ISODate format
              .replace(/NumberLong\((\d+)\)/g, '$1') // Fix NumberLong format
              .replace(/:\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, ': "$1"') // Quote unquoted strings
              .replace(/'/g, '"'); // Replace single quotes with double quotes
            
            try {
              parsedOptions = JSON.parse(optionsString);
              console.log(`   ✅ Successfully parsed after cleanup for Product ${product.product_id}`);
            } catch (secondError) {
              console.log(`   ❌ Could not parse options for Product ${product.product_id}`);
              console.log(`   Original: ${fullProduct.options.substring(0, 200)}...`);
              
              // As last resort, set empty array
              parsedOptions = [];
              console.log(`   ⚠️  Set empty options array as fallback`);
            }
          }
          
          // Update the product with parsed options
          await collection.updateOne(
            { _id: product._id },
            { $set: { options: parsedOptions } }
          );
          
          this.stats.fixed++;
          console.log(`   ✅ Updated Product ${product.product_id} with ${parsedOptions.length} options`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error fixing Product ${product.product_id}:`, error.message);
        this.stats.errors++;
      }
    }
  }

  async testSpecificProduct(productId) {
    console.log(`\n🧪 Testing specific Product ID: ${productId}`);
    
    try {
      const db = mongoose.connection.db;
      const collection = db.collection('products');
      
      const product = await collection.findOne({ product_id: productId });
      
      if (!product) {
        console.log(`❌ Product ${productId} not found`);
        return;
      }
      
      console.log(`✅ Found Product ${productId}`);
      console.log(`   Options type: ${typeof product.options}`);
      console.log(`   Is array: ${Array.isArray(product.options)}`);
      
      if (typeof product.options === 'string') {
        console.log(`   Options string content: ${product.options.substring(0, 200)}...`);
      } else if (Array.isArray(product.options)) {
        console.log(`   Options array length: ${product.options.length}`);
        if (product.options.length > 0) {
          console.log(`   First option: ${JSON.stringify(product.options[0], null, 2).substring(0, 200)}...`);
        }
      }
      
      // Try to access using Product model to see the actual error
      try {
        const Product = mongoose.model('Product');
        const productModel = await Product.findOne({ product_id: productId });
        console.log(`   ✅ Product model successfully loaded Product ${productId}`);
        console.log(`   Model options length: ${productModel.options.length}`);
      } catch (modelError) {
        console.log(`   ❌ Product model error: ${modelError.message}`);
      }
      
    } catch (error) {
      console.error(`❌ Error testing Product ${productId}:`, error.message);
    }
  }

  async generateDiagnosticReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DIAGNOSTIC REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`   Total products: ${this.stats.total_products}`);
    console.log(`   Products with options field: ${this.stats.products_with_options}`);
    console.log(`   Options as arrays (✅ correct): ${this.stats.array_options}`);
    console.log(`   Options as strings (❌ problem): ${this.stats.string_options}`);
    console.log(`   Options as null/undefined: ${this.stats.null_options}`);
    
    if (this.stats.string_options > 0) {
      console.log(`\n❌ PROBLEMATIC PRODUCTS:`);
      for (const product of this.problematicProducts.slice(0, 5)) {
        console.log(`   Product ID ${product.product_id}: ${product.options_preview}...`);
      }
      if (this.problematicProducts.length > 5) {
        console.log(`   ... and ${this.problematicProducts.length - 5} more products`);
      }
    }
    
    console.log('='.repeat(60));
  }

  async cleanup() {
    await mongoose.disconnect();
    console.log('🧹 Database connection closed');
  }
}

// Export for use in other scripts
export default ProductOptionsDiagnostic;

// Main execution function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const productId = args[1];
  
  console.log('🔍 Product Options Diagnostic Tool');
  console.log('==================================\n');
  
  const diagnostic = new ProductOptionsDiagnostic();
  
  try {
    await diagnostic.initialize();
    
    if (command === 'test' && productId) {
      // Test specific product
      await diagnostic.testSpecificProduct(parseInt(productId));
    } else {
      // Full diagnosis
      await diagnostic.diagnoseAllProducts();
    }
    
    console.log('\n✅ Diagnostic completed!');
    
    if (diagnostic.stats.fixed > 0) {
      console.log(`\n💡 Fixed ${diagnostic.stats.fixed} products`);
      console.log('   You can now try accessing the API again');
    }
    
    if (diagnostic.stats.string_options > 0 && diagnostic.stats.fixed === 0) {
      console.log('\n💡 To fix the issues automatically, run this script again');
    }
    
  } catch (error) {
    console.error('❌ Error during diagnostic:', error.message);
  } finally {
    await diagnostic.cleanup();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Usage examples:
// node scripts/diagnoseAndFixProductOptions.js          # Full diagnosis and fix
// node scripts/diagnoseAndFixProductOptions.js test 42  # Test specific product ID 42