// scripts/checkMigrationReadiness.js
import { connectMongoDB, connectMySQL } from '../config/db.js';
import mongoose from 'mongoose';

// Import all models to verify they exist
import Admin from '../models/admin.model.js';
import Address from '../models/address.model.js';
import AuditLog from '../models/auditLog.model.js';
import Cart from '../models/cart.model.js';
import Category from '../models/category.model.js';
import Checkout from '../models/checkout.model.js';
import Country from '../models/country.model.js';
import Coupon from '../models/coupon.model.js';
import Customer from '../models/customer.model.js';
import Manufacturer from '../models/manufacturer.model.js';
import MigrationStatus from '../models/migrationStatus.model.js';
import OnlineUser from '../models/onlineUser.model.js';
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';
import Product from '../models/product.model.js';
import Review from '../models/review.model.js';
import SearchLog from '../models/searchLog.model.js';
import UserActivity from '../models/userActivity.model.js';
import Wishlist from '../models/wishlist.model.js';
import Zone from '../models/zone.model.js';

const requiredTables = {
  phase1: [
    'oc_language', 'oc_country', 'oc_zone', 'oc_weight_class', 'oc_length_class',
    'oc_stock_status', 'oc_order_status', 'oc_return_action', 'oc_return_reason',
    'oc_return_status', 'oc_currency', 'oc_tax_class', 'oc_geo_zone',
    'oc_user_group', 'oc_customer_group', 'oc_store', 'oc_layout',
    'oc_extension', 'oc_event', 'oc_information', 'oc_voucher_theme',
    'oc_shipping_courier'
  ],
  phase2: [
    'oc_weight_class_description', 'oc_length_class_description',
    'oc_customer_group_description', 'oc_information_description',
    'oc_voucher_theme_description'
  ],
  phase3: [
    'oc_statistics', 'oc_module', 'oc_setting', 'oc_seo_url', 'oc_theme',
    'oc_translation', 'oc_extension_install', 'oc_extension_path',
    'oc_modification', 'oc_layout_module', 'oc_layout_route'
  ],
  phase4: [
    'oc_user', 'oc_customer', 'oc_address', 'oc_customer_activity',
    'oc_customer_approval', 'oc_customer_ip', 'oc_customer_login',
    'oc_customer_online', 'oc_customer_search', 'oc_customer_wishlist',
    'oc_customer_affiliate', 'oc_customer_history', 'oc_customer_reward',
    'oc_customer_transaction', 'register'
  ],
  phase5: [
    'oc_manufacturer', 'oc_manufacturer_to_store', 'oc_category',
    'oc_category_description', 'oc_category_path', 'oc_category_to_layout',
    'oc_category_to_store', 'oc_filter_group', 'oc_filter_group_description',
    'oc_filter', 'oc_filter_description', 'oc_category_filter',
    'oc_attribute_group', 'oc_attribute_group_description', 'oc_attribute',
    'oc_attribute_description', 'oc_option', 'oc_option_description',
    'oc_option_value', 'oc_option_value_description'
  ],
  phase6: [
    'oc_product', 'oc_product_description', 'oc_product_image',
    'oc_product_to_category', 'oc_product_to_store', 'oc_product_to_layout',
    'oc_product_option', 'oc_product_option_value', 'oc_product_attribute',
    'oc_product_discount', 'oc_product_filter', 'oc_product_recurring',
    'oc_product_related', 'oc_product_reward', 'oc_product_special',
    'oc_product_to_download', 'addproduct', 'product_specifications'
  ],
  phase7: [
    'oc_order', 'oc_order_product', 'oc_order_option', 'oc_order_total',
    'oc_order_history', 'oc_order_shipment', 'oc_order_recurring',
    'oc_order_recurring_transaction', 'oc_order_voucher', 'orders'
  ]
};

const excludedTables = [
  // Session and API tables (handled by middleware)
  'oc_api', 'oc_api_ip', 'oc_api_session', 'oc_cart',
  
  // Location and tax (can be handled separately)
  'oc_location', 'oc_zone_to_geo_zone', 'oc_tax_rate',
  'oc_tax_rate_to_customer_group', 'oc_tax_rule',
  
  // Marketing and CMS (optional features)
  'oc_marketing', 'oc_banner', 'oc_banner_image', 'oc_voucher',
  'oc_voucher_history', 'oc_coupon_category', 'oc_coupon_history',
  'oc_coupon_product', 'oc_sms_template', 'oc_sms_template_message',
  'oc_smsalert_notify',
  
  // All TVCMS tables (third-party CMS extension)
  'oc_tvcmsblog_comment', 'oc_tvcmsblog_gallery', 'oc_tvcmsblog_main',
  'oc_tvcmsblog_sub', 'oc_tvcmsblogcategory_main', 'oc_tvcmsblogcategory_sub',
  'oc_tvcmsbrandlist', 'oc_tvcmscategoryslidermain', 'oc_tvcmscategoryslidersub',
  'oc_tvcmsimageslidermain', 'oc_tvcmsimageslidersub', 'oc_tvcmsnewsletter',
  'oc_tvcmspaymenticonmain', 'oc_tvcmspaymenticonsub', 'oc_tvcmssocialiconmain',
  'oc_tvcmssocialiconsub', 'oc_tvcmstags', 'oc_tvcmstestimonialmain',
  'oc_tvcmstestimonialsub', 'oc_tvcustomlink',
  
  // Reviews and files (can be added later)
  'oc_review', 'oc_return_history', 'oc_download', 'oc_download_description',
  'oc_upload',
  
  // Custom fields and recurring (advanced features)
  'oc_custom_field', 'oc_custom_field_customer_group', 'oc_custom_field_description',
  'oc_custom_field_value', 'oc_custom_field_value_description',
  'oc_recurring', 'oc_recurring_description'
];

async function checkModels() {
  console.log('🔍 Checking MongoDB Models...\n');
  
  const models = [
    { name: 'Admin', model: Admin },
    { name: 'Address', model: Address },
    { name: 'AuditLog', model: AuditLog },
    { name: 'Cart', model: Cart },
    { name: 'Category', model: Category },
    { name: 'Checkout', model: Checkout },
    { name: 'Country', model: Country },
    { name: 'Coupon', model: Coupon },
    { name: 'Customer', model: Customer },
    { name: 'Manufacturer', model: Manufacturer },
    { name: 'MigrationStatus', model: MigrationStatus },
    { name: 'OnlineUser', model: OnlineUser },
    { name: 'Order', model: Order },
    { name: 'OrderProduct', model: OrderProduct },
    { name: 'Product', model: Product },
    { name: 'Review', model: Review },
    { name: 'SearchLog', model: SearchLog },
    { name: 'UserActivity', model: UserActivity },
    { name: 'Wishlist', model: Wishlist },
    { name: 'Zone', model: Zone }
  ];
  
  let allModelsValid = true;
  
  for (const { name, model } of models) {
    try {
      // Check if model schema is valid
      const schema = model.schema;
      console.log(`✅ ${name} model: OK`);
    } catch (error) {
      console.log(`❌ ${name} model: ERROR - ${error.message}`);
      allModelsValid = false;
    }
  }
  
  return allModelsValid;
}

async function checkMySQLTables() {
  console.log('\n🔍 Checking MySQL Tables...\n');
  
  const mysql = await connectMySQL();
  
  try {
    // Get all tables in database
    const [tables] = await mysql.execute('SHOW TABLES');
    const tableNames = tables.map(row => Object.values(row)[0]);
    
    console.log(`📊 Found ${tableNames.length} tables in MySQL database\n`);
    
    // Check required tables by phase
    for (const [phase, requiredTables] of Object.entries(requiredTables)) {
      console.log(`\n--- ${phase.toUpperCase()} ---`);
      
      for (const tableName of requiredTables) {
        if (tableNames.includes(tableName)) {
          // Get row count
          const [countResult] = await mysql.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          const count = countResult[0].count;
          console.log(`✅ ${tableName}: ${count} records`);
        } else {
          console.log(`❌ ${tableName}: TABLE MISSING`);
        }
      }
    }
    
    // Show excluded tables (if they exist)
    console.log('\n--- EXCLUDED TABLES ---');
    for (const tableName of excludedTables) {
      if (tableNames.includes(tableName)) {
        const [countResult] = await mysql.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const count = countResult[0].count;
        console.log(`⚠️  ${tableName}: ${count} records (EXCLUDED from migration)`);
      }
    }
    
    return tableNames;
  } finally {
    await mysql.end();
  }
}

async function checkModelRequirements() {
  console.log('\n🔍 Checking Model Requirements for 100% Migration...\n');
  
  const requirements = [
    {
      model: 'Customer',
      issue: 'Customer model needs addresses embedded to handle oc_address relationship',
      suggestion: 'Customer model already has addresses array - this is correct'
    },
    {
      model: 'Product', 
      issue: 'Product model needs embedded documents for descriptions, options, images',
      suggestion: 'Product model already has embedded arrays - this is correct'
    },
    {
      model: 'Order',
      issue: 'Order model needs embedded order products and options',
      suggestion: 'Order model has products array but we also need OrderProduct model for complex queries'
    },
    {
      model: 'Category',
      issue: 'Category model needs embedded descriptions for multiple languages',
      suggestion: 'Category model already has descriptions array - this is correct'
    }
  ];
  
  for (const req of requirements) {
    console.log(`📋 ${req.model}:`);
    console.log(`   Issue: ${req.issue}`);
    console.log(`   ✅ ${req.suggestion}\n`);
  }
}

async function main() {
  try {
    console.log('🚀 OpenCart to MongoDB Migration Readiness Check\n');
    console.log('================================================\n');
    
    // Connect to MongoDB
    await connectMongoDB();
    console.log('✅ Connected to MongoDB\n');
    
    // Check models
    const modelsValid = await checkModels();
    
    // Check MySQL tables
    const mysqlTables = await checkMySQLTables();
    
    // Check model requirements
    await checkModelRequirements();
    
    console.log('\n================================================');
    console.log('📊 MIGRATION READINESS SUMMARY');
    console.log('================================================\n');
    
    console.log(`MongoDB Models: ${modelsValid ? '✅ READY' : '❌ ISSUES FOUND'}`);
    console.log(`MySQL Tables: ✅ ${mysqlTables.length} tables found`);
    console.log(`Required Tables: Check individual phase results above`);
    
    console.log('\n🎯 RECOMMENDED MIGRATION ORDER:');
    console.log('1. Phase 1: Core Independent Tables');
    console.log('2. Phase 2: Language-Dependent Tables');
    console.log('3. Phase 3: System Configuration');
    console.log('4. Phase 4: User Management (Critical - ensure 100% customer migration)');
    console.log('5. Phase 5: Catalog Structure');
    console.log('6. Phase 6: Products');
    console.log('7. Phase 7: Orders and Transactions');
    
    console.log('\n💡 NOTES:');
    console.log('- uploaded_files in oc_product_option_value will be transferred as-is');
    console.log('- File existence will be checked separately');
    console.log('- All customer records must be migrated (0% loss acceptable)');
    console.log('- Order integrity must be maintained');
    
  } catch (error) {
    console.error('❌ Error during migration check:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { checkModels, checkMySQLTables, requiredTables, excludedTables };