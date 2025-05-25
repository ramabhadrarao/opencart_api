// Create this file: scripts/checkOptionSchema.js
import { connectMySQL } from '../config/db.js';

async function checkOptionSchema() {
  console.log('🔍 Checking Option Tables Schema...\n');
  
  const mysql = await connectMySQL();
  
  try {
    // Check oc_option structure
    console.log('📋 oc_option table structure:');
    const [optionColumns] = await mysql.execute('DESCRIBE oc_option');
    optionColumns.forEach(col => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n📋 oc_option_description table structure:');
    const [optionDescColumns] = await mysql.execute('DESCRIBE oc_option_description');
    optionDescColumns.forEach(col => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    console.log('\n📋 oc_product_option table structure:');
    const [productOptionColumns] = await mysql.execute('DESCRIBE oc_product_option');
    productOptionColumns.forEach(col => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    // Sample data from each table
    console.log('\n📊 Sample data from oc_option:');
    const [optionSample] = await mysql.execute('SELECT * FROM oc_option LIMIT 5');
    console.log(optionSample);
    
    console.log('\n📊 Sample data from oc_option_description:');
    const [optionDescSample] = await mysql.execute('SELECT * FROM oc_option_description LIMIT 5');
    console.log(optionDescSample);
    
    console.log('\n📊 Sample data from oc_product_option:');
    const [productOptionSample] = await mysql.execute('SELECT * FROM oc_product_option LIMIT 5');
    console.log(productOptionSample);
    
  } catch (error) {
    console.error('❌ Error checking schema:', error.message);
  } finally {
    await mysql.end();
  }
}

checkOptionSchema();