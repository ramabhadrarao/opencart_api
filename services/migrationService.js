// services/migrationService.js
import { connectMongoDB, connectMySQL } from '../config/db.js';
import MigrationStatus from '../models/migrationStatus.model.js';
import mongoose from 'mongoose';

// Import models for each phase
import Country from '../models/country.model.js';
import Zone from '../models/zone.model.js';
import Category from '../models/category.model.js';
import Manufacturer from '../models/manufacturer.model.js';
import Customer from '../models/customer.model.js';
import Admin from '../models/admin.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';

class MigrationService {
  constructor() {
    this.mysql = null;
    this.startTime = null;
    this.stats = {
      processed: 0,
      succeeded: 0,
      failed: 0
    };
  }

  async initialize() {
    await connectMongoDB();
    this.mysql = await connectMySQL();
    console.log('✅ Database connections established');
  }

  async updateMigrationStatus(name, status, error = null, details = null) {
    try {
      const update = {
        status,
        last_run: new Date(),
        processed: this.stats.processed,
        succeeded: this.stats.succeeded,
        failed: this.stats.failed
      };

      if (status === 'running' && !this.startTime) {
        this.startTime = new Date();
        update.first_run = this.startTime;
      }

      if (status === 'completed' || status === 'failed') {
        if (this.startTime) {
          update.duration_seconds = Math.floor((new Date() - this.startTime) / 1000);
        }
      }

      if (error) {
        update.error = error.message;
        update.stack = error.stack;
      }

      if (details) {
        update.details = details;
      }

      await MigrationStatus.findOneAndUpdate(
        { name },
        update,
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error(`Error updating migration status for ${name}:`, err);
    }
  }

  resetStats() {
    this.stats = { processed: 0, succeeded: 0, failed: 0 };
    this.startTime = null;
  }

  // PHASE 1: Core Independent Tables
  async migratePhase1() {
    const phaseName = 'phase1_core_independent';
    console.log('\n🚀 Starting Phase 1: Core Independent Tables...\n');
    
    this.resetStats();
    await this.updateMigrationStatus(phaseName, 'running');

    try {
      // Migrate countries
      await this.migrateCountries();
      
      // Migrate zones
      await this.migrateZones();
      
      // Add other Phase 1 tables here (language, currency, etc.)
      await this.migrateBasicLookupTables();

      await this.updateMigrationStatus(phaseName, 'completed', null, {
        tables_migrated: ['oc_country', 'oc_zone', 'lookup_tables'],
        total_records: this.stats.succeeded
      });

      console.log(`✅ Phase 1 completed: ${this.stats.succeeded} records migrated`);
      return true;
    } catch (error) {
      await this.updateMigrationStatus(phaseName, 'failed', error);
      console.error('❌ Phase 1 failed:', error);
      throw error;
    }
  }

  async migrateCountries() {
  console.log('📍 Migrating countries...');
  
  const [rows] = await this.mysql.execute('SELECT * FROM oc_country ORDER BY country_id');
  let countryCount = 0;
  
  for (const row of rows) {
    try {
      this.stats.processed++;
      
      const country = new Country({
        country_id: row.country_id,
        name: row.name,
        iso_code_2: row.iso_code_2,
        iso_code_3: row.iso_code_3,
        address_format: row.address_format,
        postcode_required: row.postcode_required === 1,
        status: row.status === 1
      });

      await country.save();
      this.stats.succeeded++;
      countryCount++;
      
      if (countryCount % 50 === 0) {
        console.log(`   ✅ Countries: ${countryCount}/${rows.length}`);
      }
    } catch (error) {
      this.stats.failed++;
      console.error(`❌ Failed to migrate country ${row.country_id}: ${error.message}`);
    }
  }
  
  console.log(`✅ Countries migration: ${countryCount}/${rows.length} successful\n`);
}

  async migrateZones() {
  console.log('🗺️  Migrating zones...');
  
  const [rows] = await this.mysql.execute('SELECT * FROM oc_zone ORDER BY zone_id');
  const totalZones = rows.length;
  let zoneCount = 0;
  
  for (const row of rows) {
    try {
      this.stats.processed++;
      
      const zone = new Zone({
        zone_id: row.zone_id,
        country_id: row.country_id,
        name: row.name,
        code: row.code,
        status: row.status === 1
      });

      await zone.save();
      this.stats.succeeded++;
      zoneCount++;
      
      if (zoneCount % 100 === 0) {
        console.log(`   ✅ Zones: ${zoneCount}/${totalZones}`);
      }
    } catch (error) {
      this.stats.failed++;
      console.error(`❌ Failed to migrate zone ${row.zone_id}: ${error.message}`);
    }
  }
  
  console.log(`✅ Zones migration: ${zoneCount}/${totalZones} successful\n`);
}

  async migrateBasicLookupTables() {
    // This would include tables like oc_language, oc_currency, etc.
    // For now, we'll create default entries
    console.log('📚 Setting up basic lookup data...');
    
    // Create default language if not exists
    try {
      const languageCount = await mongoose.connection.db.collection('languages').countDocuments();
      if (languageCount === 0) {
        await mongoose.connection.db.collection('languages').insertOne({
          language_id: 1,
          name: 'English',
          code: 'en-gb',
          locale: 'en_US.UTF-8',
          image: 'gb.png',
          directory: 'english',
          sort_order: 1,
          status: true
        });
        console.log('   ✅ Default language created');
      }
    } catch (error) {
      console.error('❌ Error creating default language:', error.message);
    }
  }

  // PHASE 4: User Management (Critical Phase)
  async migratePhase4() {
    const phaseName = 'phase4_user_management';
    console.log('\n🚀 Starting Phase 4: User Management (CRITICAL)...\n');
    
    this.resetStats();
    await this.updateMigrationStatus(phaseName, 'running');

    try {
      // First migrate admins
      await this.migrateAdmins();
      
      // Then migrate customers WITH their addresses
      await this.migrateCustomersWithAddresses();
      
      // Verify 100% customer migration
      await this.verifyCustomerMigration();

      await this.updateMigrationStatus(phaseName, 'completed', null, {
        tables_migrated: ['oc_user', 'oc_customer', 'oc_address'],
        total_records: this.stats.succeeded,
        customer_verification: 'PASSED'
      });

      console.log(`✅ Phase 4 completed: ${this.stats.succeeded} records migrated`);
      return true;
    } catch (error) {
      await this.updateMigrationStatus(phaseName, 'failed', error);
      console.error('❌ Phase 4 failed:', error);
      throw error;
    }
  }

  async migrateAdmins() {
    console.log('👨‍💼 Migrating admins...');
    
    const [rows] = await this.mysql.execute('SELECT * FROM oc_user ORDER BY user_id');
    
    for (const row of rows) {
      try {
        this.stats.processed++;
        
        const admin = new Admin({
          user_id: row.user_id,
          user_group_id: row.user_group_id,
          username: row.username,
          password: row.password,
          salt: row.salt,
          firstname: row.firstname,
          lastname: row.lastname,
          email: row.email,
          image: row.image,
          code: row.code,
          ip: row.ip,
          status: row.status === 1,
          date_added: row.date_added
        });

        await admin.save();
        this.stats.succeeded++;
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate admin ${row.user_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Admins migration: ${this.stats.succeeded}/${rows.length} successful\n`);
  }

  async migrateCustomersWithAddresses() {
    console.log('👥 Migrating customers with addresses...');
    
    // Get all customers
    const [customers] = await this.mysql.execute(`
      SELECT * FROM oc_customer 
      ORDER BY customer_id
    `);
    
    console.log(`📊 Found ${customers.length} customers to migrate`);
    
    for (const customerRow of customers) {
      try {
        this.stats.processed++;
        
        // Get customer's addresses
        const [addresses] = await this.mysql.execute(`
          SELECT * FROM oc_address 
          WHERE customer_id = ? 
          ORDER BY address_id
        `, [customerRow.customer_id]);
        
        // Transform addresses to embedded format
        const addressesMongo = addresses.map(addr => ({
          address_id: addr.address_id,
          firstname: addr.firstname,
          lastname: addr.lastname,
          company: addr.company,
          address_1: addr.address_1,
          address_2: addr.address_2,
          city: addr.city,
          postcode: addr.postcode,
          country_id: addr.country_id,
          zone_id: addr.zone_id,
          custom_field: addr.custom_field ? JSON.parse(addr.custom_field) : {}
        }));

        const customer = new Customer({
          customer_id: customerRow.customer_id,
          customer_group_id: customerRow.customer_group_id,
          store_id: customerRow.store_id || 0,
          language_id: customerRow.language_id || 1,
          firstname: customerRow.firstname,
          lastname: customerRow.lastname,
          email: customerRow.email,
          telephone: customerRow.telephone,
          fax: customerRow.fax || '',
          password: customerRow.password,
          salt: customerRow.salt,
          cart: customerRow.cart,
          wishlist: customerRow.wishlist ? customerRow.wishlist.split(',').map(Number).filter(n => n) : [],
          newsletter: customerRow.newsletter === 1,
          address_id: customerRow.address_id || 0,
          custom_field: customerRow.custom_field ? JSON.parse(customerRow.custom_field) : {},
          ip: customerRow.ip,
          status: customerRow.status === 1,
          safe: customerRow.safe === 1,
          token: customerRow.token,
          code: customerRow.code,
          date_added: customerRow.date_added,
          
          // Embedded addresses
          addresses: addressesMongo
        });

        await customer.save();
        this.stats.succeeded++;
        
        if (this.stats.succeeded % 1000 === 0) {
          console.log(`   ✅ Customers: ${this.stats.succeeded}/${customers.length} (${addresses.length} addresses for this customer)`);
        }
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate customer ${customerRow.customer_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Customers migration: ${this.stats.succeeded}/${customers.length} successful\n`);
  }

  async verifyCustomerMigration() {
    console.log('🔍 Verifying customer migration (100% requirement)...');
    
    // Count MySQL customers
    const [mysqlCount] = await this.mysql.execute('SELECT COUNT(*) as count FROM oc_customer');
    const mysqlCustomers = mysqlCount[0].count;
    
    // Count MongoDB customers
    const mongoCustomers = await Customer.countDocuments();
    
    // Count MySQL addresses
    const [mysqlAddrCount] = await this.mysql.execute('SELECT COUNT(*) as count FROM oc_address');
    const mysqlAddresses = mysqlAddrCount[0].count;
    
    // Count MongoDB addresses (embedded)
    const mongoAddresses = await Customer.aggregate([
      { $project: { addressCount: { $size: '$addresses' } } },
      { $group: { _id: null, totalAddresses: { $sum: '$addressCount' } } }
    ]);
    const mongoAddressCount = mongoAddresses.length > 0 ? mongoAddresses[0].totalAddresses : 0;
    
    console.log(`📊 Migration Verification:`);
    console.log(`   MySQL Customers: ${mysqlCustomers}`);
    console.log(`   MongoDB Customers: ${mongoCustomers}`);
    console.log(`   MySQL Addresses: ${mysqlAddresses}`);
    console.log(`   MongoDB Addresses: ${mongoAddressCount}`);
    
    if (mysqlCustomers !== mongoCustomers) {
      throw new Error(`CRITICAL: Customer count mismatch! MySQL: ${mysqlCustomers}, MongoDB: ${mongoCustomers}`);
    }
    
    if (mysqlAddresses !== mongoAddressCount) {
      throw new Error(`CRITICAL: Address count mismatch! MySQL: ${mysqlAddresses}, MongoDB: ${mongoAddressCount}`);
    }
    
    console.log('✅ 100% Customer migration verified!\n');
  }

  // PHASE 5: Catalog Structure
  async migratePhase5() {
    const phaseName = 'phase5_catalog_structure';
    console.log('\n🚀 Starting Phase 5: Catalog Structure...\n');
    
    this.resetStats();
    await this.updateMigrationStatus(phaseName, 'running');

    try {
      await this.migrateManufacturers();
      await this.migrateCategories();
      await this.migrateCategoryDescriptions();
      await this.migrateCategoryPaths();

      await this.updateMigrationStatus(phaseName, 'completed', null, {
        tables_migrated: ['oc_manufacturer', 'oc_category', 'oc_category_description'],
        total_records: this.stats.succeeded
      });

      console.log(`✅ Phase 5 completed: ${this.stats.succeeded} records migrated`);
      return true;
    } catch (error) {
      await this.updateMigrationStatus(phaseName, 'failed', error);
      console.error('❌ Phase 5 failed:', error);
      throw error;
    }
  }

  async migrateManufacturers() {
    console.log('🏭 Migrating manufacturers...');
    
    const [rows] = await this.mysql.execute('SELECT * FROM oc_manufacturer ORDER BY manufacturer_id');
    
    for (const row of rows) {
      try {
        this.stats.processed++;
        
        const manufacturer = new Manufacturer({
          manufacturer_id: row.manufacturer_id,
          name: row.name,
          image: row.image,
          sort_order: row.sort_order
        });

        await manufacturer.save();
        this.stats.succeeded++;
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate manufacturer ${row.manufacturer_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Manufacturers migration: ${this.stats.succeeded}/${rows.length} successful\n`);
  }

  async migrateCategories() {
    console.log('📂 Migrating categories...');
    
    const [categories] = await this.mysql.execute('SELECT * FROM oc_category ORDER BY category_id');
    
    for (const categoryRow of categories) {
      try {
        this.stats.processed++;
        
        const category = new Category({
          category_id: categoryRow.category_id,
          parent_id: categoryRow.parent_id,
          image: categoryRow.image,
          top: categoryRow.top === 1,
          column: categoryRow.column,
          sort_order: categoryRow.sort_order,
          status: categoryRow.status === 1,
          date_added: categoryRow.date_added,
          date_modified: categoryRow.date_modified,
          descriptions: [], // Will be populated in next step
          stores: [0] // Default store
        });

        await category.save();
        this.stats.succeeded++;
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate category ${categoryRow.category_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Categories migration: ${this.stats.succeeded}/${categories.length} successful\n`);
  }

  async migrateCategoryDescriptions() {
    console.log('📝 Migrating category descriptions...');
    
    const [descriptions] = await this.mysql.execute(`
      SELECT cd.*, c.category_id 
      FROM oc_category_description cd
      JOIN oc_category c ON cd.category_id = c.category_id
      ORDER BY cd.category_id, cd.language_id
    `);
    
    // Group descriptions by category
    const descriptionsByCategory = {};
    descriptions.forEach(desc => {
      if (!descriptionsByCategory[desc.category_id]) {
        descriptionsByCategory[desc.category_id] = [];
      }
      descriptionsByCategory[desc.category_id].push({
        language_id: desc.language_id,
        name: desc.name,
        description: desc.description,
        meta_title: desc.meta_title,
        meta_description: desc.meta_description,
        meta_keyword: desc.meta_keyword
      });
    });
    
    // Update categories with descriptions
    for (const [categoryId, descriptions] of Object.entries(descriptionsByCategory)) {
      try {
        await Category.updateOne(
          { category_id: parseInt(categoryId) },
          { $set: { descriptions } }
        );
        this.stats.succeeded++;
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to update category descriptions for ${categoryId}: ${error.message}`);
      }
    }
    
    console.log(`✅ Category descriptions updated for ${Object.keys(descriptionsByCategory).length} categories\n`);
  }

  async migrateCategoryPaths() {
    console.log('🛤️  Migrating category paths...');
    
    const [paths] = await this.mysql.execute(`
      SELECT * FROM oc_category_path 
      ORDER BY category_id, level
    `);
    
    // Group paths by category
    const pathsByCategory = {};
    paths.forEach(path => {
      if (!pathsByCategory[path.category_id]) {
        pathsByCategory[path.category_id] = [];
      }
      pathsByCategory[path.category_id].push(path.path_id);
    });
    
    // Update categories with path info
    for (const [categoryId, pathArray] of Object.entries(pathsByCategory)) {
      try {
        await Category.updateOne(
          { category_id: parseInt(categoryId) },
          { $set: { path: pathArray } }
        );
      } catch (error) {
        console.error(`❌ Failed to update category path for ${categoryId}: ${error.message}`);
      }
    }
    
    console.log(`✅ Category paths updated for ${Object.keys(pathsByCategory).length} categories\n`);
  }

  // PHASE 6: Products
  async migratePhase6() {
    const phaseName = 'phase6_products';
    console.log('\n🚀 Starting Phase 6: Products...\n');
    
    this.resetStats();
    await this.updateMigrationStatus(phaseName, 'running');

    try {
      await this.migrateProducts();
      await this.verifyProductMigration();

      await this.updateMigrationStatus(phaseName, 'completed', null, {
        tables_migrated: ['oc_product', 'oc_product_description', 'oc_product_option', 'oc_product_option_value'],
        total_records: this.stats.succeeded
      });

      console.log(`✅ Phase 6 completed: ${this.stats.succeeded} records migrated`);
      return true;
    } catch (error) {
      await this.updateMigrationStatus(phaseName, 'failed', error);
      console.error('❌ Phase 6 failed:', error);
      throw error;
    }
  }

  async migrateProducts() {
    console.log('📦 Migrating products with full relationships...');
    
    const [products] = await this.mysql.execute('SELECT * FROM oc_product ORDER BY product_id');
    
    console.log(`📊 Found ${products.length} products to migrate`);
    
    for (const productRow of products) {
      try {
        this.stats.processed++;
        
        // Get product descriptions
        const [descriptions] = await this.mysql.execute(`
          SELECT * FROM oc_product_description 
          WHERE product_id = ?
        `, [productRow.product_id]);
        
        // Get product categories
        const [categories] = await this.mysql.execute(`
          SELECT category_id FROM oc_product_to_category 
          WHERE product_id = ?
        `, [productRow.product_id]);
        
        // Get product images
        const [images] = await this.mysql.execute(`
          SELECT * FROM oc_product_image 
          WHERE product_id = ? 
          ORDER BY sort_order
        `, [productRow.product_id]);
        
        // Get product options and their values
        const [options] = await this.mysql.execute(`
          SELECT po.*, od.name as option_name, od.type 
          FROM oc_product_option po
          LEFT JOIN oc_option_description od ON po.option_id = od.option_id AND od.language_id = 1
          WHERE po.product_id = ?
          ORDER BY po.product_option_id
        `, [productRow.product_id]);
        
        // Get option values for each option
        const optionsWithValues = [];
        for (const option of options) {
          const [values] = await this.mysql.execute(`
            SELECT pov.*, ovd.name as value_name
            FROM oc_product_option_value pov
            LEFT JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id AND ovd.language_id = 1
            WHERE pov.product_option_id = ?
            ORDER BY pov.product_option_value_id
          `, [option.product_option_id]);
          
          optionsWithValues.push({
            product_option_id: option.product_option_id,
            option_id: option.option_id,
            name: option.option_name,
            type: option.type,
            required: option.required === 1,
            values: values.map(val => ({
              product_option_value_id: val.product_option_value_id,
              option_value_id: val.option_value_id,
              name: val.value_name,
              quantity: val.quantity,
              subtract: val.subtract === 1,
              price: parseFloat(val.price),
              price_prefix: val.price_prefix,
              weight: parseFloat(val.weight),
              weight_prefix: val.weight_prefix,
              uploaded_file: val.uploaded_files || '' // Keep file reference for later verification
            }))
          });
        }

        const product = new Product({
          product_id: productRow.product_id,
          model: productRow.model,
          sku: productRow.sku,
          upc: productRow.upc,
          ean: productRow.ean,
          jan: productRow.jan,
          isbn: productRow.isbn,
          mpn: productRow.mpn,
          location: productRow.location,
          quantity: productRow.quantity,
          stock_status_id: productRow.stock_status_id,
          image: productRow.image,
          manufacturer_id: productRow.manufacturer_id,
          shipping: productRow.shipping === 1,
          price: parseFloat(productRow.price),
          points: productRow.points,
          tax_class_id: productRow.tax_class_id,
          date_available: productRow.date_available,
          weight: parseFloat(productRow.weight),
          weight_class_id: productRow.weight_class_id,
          length: parseFloat(productRow.length),
          width: parseFloat(productRow.width),
          height: parseFloat(productRow.height),
          length_class_id: productRow.length_class_id,
          subtract: productRow.subtract === 1,
          minimum: productRow.minimum,
          sort_order: productRow.sort_order,
          status: productRow.status === 1,
          viewed: productRow.viewed,
          date_added: productRow.date_added,
          date_modified: productRow.date_modified,
          
          // Embedded relationships
          descriptions: descriptions.map(desc => ({
            language_id: desc.language_id,
            name: desc.name,
            description: desc.description,
            tag: desc.tag,
            meta_title: desc.meta_title,
            meta_description: desc.meta_description,
            meta_keyword: desc.meta_keyword
          })),
          
          categories: categories.map(cat => cat.category_id),
          
          additional_images: images.map(img => ({
            product_image_id: img.product_image_id,
            image: img.image,
            sort_order: img.sort_order
          })),
          
          options: optionsWithValues,
          stores: [0] // Default store
        });

        await product.save();
        this.stats.succeeded++;
        
        if (this.stats.succeeded % 100 === 0) {
          console.log(`   ✅ Products: ${this.stats.succeeded}/${products.length}`);
        }
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate product ${productRow.product_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Products migration: ${this.stats.succeeded}/${products.length} successful\n`);
  }

  async verifyProductMigration() {
    console.log('🔍 Verifying product migration...');
    
    // Count MySQL products
    const [mysqlCount] = await this.mysql.execute('SELECT COUNT(*) as count FROM oc_product');
    const mysqlProducts = mysqlCount[0].count;
    
    // Count MongoDB products
    const mongoProducts = await Product.countDocuments();
    
    console.log(`📊 Product Migration Verification:`);
    console.log(`   MySQL Products: ${mysqlProducts}`);
    console.log(`   MongoDB Products: ${mongoProducts}`);
    
    if (mysqlProducts !== mongoProducts) {
      throw new Error(`CRITICAL: Product count mismatch! MySQL: ${mysqlProducts}, MongoDB: ${mongoProducts}`);
    }
    
    console.log('✅ Product migration verified!\n');
  }

  // PHASE 7: Orders and Transactions
  async migratePhase7() {
    const phaseName = 'phase7_orders';
    console.log('\n🚀 Starting Phase 7: Orders and Transactions...\n');
    
    this.resetStats();
    await this.updateMigrationStatus(phaseName, 'running');

    try {
      await this.migrateOrders();
      await this.verifyOrderMigration();

      await this.updateMigrationStatus(phaseName, 'completed', null, {
        tables_migrated: ['oc_order', 'oc_order_product', 'oc_order_option'],
        total_records: this.stats.succeeded
      });

      console.log(`✅ Phase 7 completed: ${this.stats.succeeded} records migrated`);
      return true;
    } catch (error) {
      await this.updateMigrationStatus(phaseName, 'failed', error);
      console.error('❌ Phase 7 failed:', error);
      throw error;
    }
  }

  async migrateOrders() {
    console.log('🛒 Migrating orders with products and options...');
    
    const [orders] = await this.mysql.execute('SELECT * FROM oc_order ORDER BY order_id');
    
    console.log(`📊 Found ${orders.length} orders to migrate`);
    
    for (const orderRow of orders) {
      try {
        this.stats.processed++;
        
        // Get order products
        const [orderProducts] = await this.mysql.execute(`
          SELECT * FROM oc_order_product 
          WHERE order_id = ?
          ORDER BY order_product_id
        `, [orderRow.order_id]);
        
        // Get order options for each product
        const productsWithOptions = [];
        for (const product of orderProducts) {
          const [options] = await this.mysql.execute(`
            SELECT * FROM oc_order_option 
            WHERE order_product_id = ?
            ORDER BY order_option_id
          `, [product.order_product_id]);
          
          productsWithOptions.push({
            order_product_id: product.order_product_id,
            product_id: product.product_id,
            name: product.name,
            model: product.model,
            quantity: product.quantity,
            price: parseFloat(product.price),
            total: parseFloat(product.total),
            tax: parseFloat(product.tax),
            reward: product.reward,
            options: options.map(opt => ({
              order_option_id: opt.order_option_id,
              product_option_id: opt.product_option_id,
              product_option_value_id: opt.product_option_value_id,
              name: opt.name,
              value: opt.value,
              type: opt.type
            }))
          });
          
          // Also save to OrderProduct collection for complex queries
          try {
            const orderProduct = new OrderProduct({
              order_product_id: product.order_product_id,
              order_id: orderRow.order_id,
              product_id: product.product_id,
              name: product.name,
              model: product.model,
              quantity: product.quantity,
              price: parseFloat(product.price),
              total: parseFloat(product.total),
              tax: parseFloat(product.tax),
              reward: product.reward,
              options: options.map(opt => ({
                order_option_id: opt.order_option_id,
                product_option_id: opt.product_option_id,
                product_option_value_id: opt.product_option_value_id,
                name: opt.name,
                value: opt.value,
                type: opt.type
              }))
            });
            
            await orderProduct.save();
          } catch (opError) {
            console.error(`❌ Failed to save OrderProduct ${product.order_product_id}: ${opError.message}`);
          }
        }

        const order = new Order({
          order_id: orderRow.order_id,
          invoice_no: orderRow.invoice_no,
          invoice_prefix: orderRow.invoice_prefix,
          store_id: orderRow.store_id,
          store_name: orderRow.store_name,
          store_url: orderRow.store_url,
          customer_id: orderRow.customer_id,
          customer_group_id: orderRow.customer_group_id,
          firstname: orderRow.firstname,
          lastname: orderRow.lastname,
          email: orderRow.email,
          telephone: orderRow.telephone,
          fax: orderRow.fax,
          custom_field: orderRow.custom_field,
          
          // Payment details
          payment_firstname: orderRow.payment_firstname,
          payment_lastname: orderRow.payment_lastname,
          payment_company: orderRow.payment_company,
          payment_address_1: orderRow.payment_address_1,
          payment_address_2: orderRow.payment_address_2,
          payment_city: orderRow.payment_city,
          payment_postcode: orderRow.payment_postcode,
          payment_country: orderRow.payment_country,
          payment_country_id: orderRow.payment_country_id,
          payment_zone: orderRow.payment_zone,
          payment_zone_id: orderRow.payment_zone_id,
          payment_address_format: orderRow.payment_address_format,
          payment_custom_field: orderRow.payment_custom_field,
          payment_method: orderRow.payment_method,
          payment_code: orderRow.payment_code,
          
          // Shipping details
          shipping_firstname: orderRow.shipping_firstname,
          shipping_lastname: orderRow.shipping_lastname,
          shipping_company: orderRow.shipping_company,
          shipping_address_1: orderRow.shipping_address_1,
          shipping_address_2: orderRow.shipping_address_2,
          shipping_city: orderRow.shipping_city,
          shipping_postcode: orderRow.shipping_postcode,
          shipping_country: orderRow.shipping_country,
          shipping_country_id: orderRow.shipping_country_id,
          shipping_zone: orderRow.shipping_zone,
          shipping_zone_id: orderRow.shipping_zone_id,
          shipping_address_format: orderRow.shipping_address_format,
          shipping_custom_field: orderRow.shipping_custom_field,
          shipping_method: orderRow.shipping_method,
          shipping_code: orderRow.shipping_code,
          
          comment: orderRow.comment,
          total: parseFloat(orderRow.total),
          order_status_id: orderRow.order_status_id,
          affiliate_id: orderRow.affiliate_id,
          commission: parseFloat(orderRow.commission),
          tracking: orderRow.tracking,
          language_id: orderRow.language_id,
          currency_id: orderRow.currency_id,
          currency_code: orderRow.currency_code,
          currency_value: parseFloat(orderRow.currency_value),
          ip: orderRow.ip,
          forwarded_ip: orderRow.forwarded_ip,
          user_agent: orderRow.user_agent,
          accept_language: orderRow.accept_language,
          date_added: orderRow.date_added,
          date_modified: orderRow.date_modified,
          
          // Embedded products
          products: productsWithOptions
        });

        await order.save();
        this.stats.succeeded++;
        
        if (this.stats.succeeded % 1000 === 0) {
          console.log(`   ✅ Orders: ${this.stats.succeeded}/${orders.length}`);
        }
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to migrate order ${orderRow.order_id}: ${error.message}`);
      }
    }
    
    console.log(`✅ Orders migration: ${this.stats.succeeded}/${orders.length} successful\n`);
  }

  async verifyOrderMigration() {
    console.log('🔍 Verifying order migration...');
    
    // Count MySQL orders
    const [mysqlOrderCount] = await this.mysql.execute('SELECT COUNT(*) as count FROM oc_order');
    const mysqlOrders = mysqlOrderCount[0].count;
    
    // Count MySQL order products
    const [mysqlProductCount] = await this.mysql.execute('SELECT COUNT(*) as count FROM oc_order_product');
    const mysqlOrderProducts = mysqlProductCount[0].count;
    
    // Count MongoDB orders
    const mongoOrders = await Order.countDocuments();
    
    // Count MongoDB order products
    const mongoOrderProducts = await OrderProduct.countDocuments();
    
    console.log(`📊 Order Migration Verification:`);
    console.log(`   MySQL Orders: ${mysqlOrders}`);
    console.log(`   MongoDB Orders: ${mongoOrders}`);
    console.log(`   MySQL Order Products: ${mysqlOrderProducts}`);
    console.log(`   MongoDB Order Products: ${mongoOrderProducts}`);
    
    if (mysqlOrders !== mongoOrders) {
      throw new Error(`CRITICAL: Order count mismatch! MySQL: ${mysqlOrders}, MongoDB: ${mongoOrders}`);
    }
    
    if (mysqlOrderProducts !== mongoOrderProducts) {
      throw new Error(`CRITICAL: Order Product count mismatch! MySQL: ${mysqlOrderProducts}, MongoDB: ${mongoOrderProducts}`);
    }
    
    console.log('✅ Order migration verified!\n');
  }

  async cleanup() {
    if (this.mysql) {
      await this.mysql.end();
    }
    await mongoose.disconnect();
    console.log('🧹 Database connections closed');
  }
}

export default MigrationService;