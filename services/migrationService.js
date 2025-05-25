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

  // Replace the migrateProducts method in your MigrationService class

// Replace the migrateProducts method in your MigrationService class
// This is corrected for your exact schema

// Replace the entire migrateProducts method in your MigrationService with this version
// This bypasses Mongoose validation and inserts directly into MongoDB

async migrateProducts() {
  console.log('📦 Migrating products directly to MongoDB (bypassing Mongoose validation)...');
  
  const [products] = await this.mysql.execute('SELECT * FROM oc_product ORDER BY product_id');
  
  console.log(`📊 Found ${products.length} products to migrate`);
  
  // Use direct MongoDB collection instead of Mongoose model
  const productsCollection = mongoose.connection.db.collection('products');
  
  // Process in batches for better performance
  const batchSize = 50;
  let processedCount = 0;
  
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const documentsToInsert = [];
    
    for (const productRow of batch) {
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
        
        // Get product options
        const [options] = await this.mysql.execute(`
          SELECT 
            po.product_option_id,
            po.option_id,
            po.value as option_value,
            po.required,
            od.name as option_name,
            o.type as option_type,
            o.sort_order
          FROM oc_product_option po
          LEFT JOIN oc_option o ON po.option_id = o.option_id
          LEFT JOIN oc_option_description od ON po.option_id = od.option_id AND od.language_id = 1
          WHERE po.product_id = ?
          ORDER BY po.product_option_id
        `, [productRow.product_id]);
        
        // Get option values for each option
        const optionsWithValues = [];
        for (const option of options) {
          const [values] = await this.mysql.execute(`
            SELECT 
              pov.product_option_value_id,
              pov.option_value_id,
              pov.quantity,
              pov.subtract,
              pov.price,
              pov.price_prefix,
              pov.weight,
              pov.weight_prefix,
              pov.uploaded_files,
              ovd.name as value_name
            FROM oc_product_option_value pov
            LEFT JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id AND ovd.language_id = 1
            WHERE pov.product_option_id = ?
            ORDER BY pov.product_option_value_id
          `, [option.product_option_id]);
          
          optionsWithValues.push({
            product_option_id: option.product_option_id,
            option_id: option.option_id,
            name: option.option_name || 'Unknown Option',
            type: option.option_type || 'select',
            value: option.option_value || '',
            required: option.required === 1,
            sort_order: option.sort_order || 0,
            values: values.map(val => ({
              product_option_value_id: val.product_option_value_id,
              option_value_id: val.option_value_id,
              name: val.value_name || 'Unknown Value',
              quantity: val.quantity || 0,
              subtract: val.subtract === 1,
              price: parseFloat(val.price) || 0,
              price_prefix: val.price_prefix || '+',
              weight: parseFloat(val.weight) || 0,
              weight_prefix: val.weight_prefix || '+',
              uploaded_file: val.uploaded_files || ''
            }))
          });
        }

        // Get product attributes
        const [attributes] = await this.mysql.execute(`
          SELECT 
            pa.attribute_id,
            pa.text,
            ad.name as attribute_name,
            a.attribute_group_id
          FROM oc_product_attribute pa
          LEFT JOIN oc_attribute_description ad ON pa.attribute_id = ad.attribute_id AND ad.language_id = 1
          LEFT JOIN oc_attribute a ON pa.attribute_id = a.attribute_id
          WHERE pa.product_id = ?
          ORDER BY pa.attribute_id
        `, [productRow.product_id]);

        // Get related products
        const [relatedProducts] = await this.mysql.execute(`
          SELECT related_id FROM oc_product_related 
          WHERE product_id = ?
        `, [productRow.product_id]);

        // Get product specials
        const [specials] = await this.mysql.execute(`
          SELECT 
            product_special_id,
            customer_group_id,
            priority,
            price,
            date_start,
            date_end
          FROM oc_product_special 
          WHERE product_id = ?
          ORDER BY priority, date_start
        `, [productRow.product_id]);

        // Get product discounts
        const [discounts] = await this.mysql.execute(`
          SELECT 
            product_discount_id,
            customer_group_id,
            quantity,
            priority,
            price,
            date_start,
            date_end
          FROM oc_product_discount 
          WHERE product_id = ?
          ORDER BY quantity
        `, [productRow.product_id]);

        // Create product document directly (no Mongoose validation)
        const productDocument = {
          product_id: productRow.product_id,
          model: productRow.model,
          sku: productRow.sku,
          upc: productRow.upc,
          ean: productRow.ean,
          jan: productRow.jan,
          isbn: productRow.isbn,
          mpn: productRow.mpn,
          location: productRow.location,
          quantity: productRow.quantity || 0,
          stock_status_id: productRow.stock_status_id,
          image: productRow.image,
          manufacturer_id: productRow.manufacturer_id,
          shipping: productRow.shipping === 1,
          price: parseFloat(productRow.price) || 0,
          points: productRow.points || 0,
          tax_class_id: productRow.tax_class_id,
          date_available: productRow.date_available,
          weight: parseFloat(productRow.weight) || 0,
          weight_class_id: productRow.weight_class_id,
          length: parseFloat(productRow.length) || 0,
          width: parseFloat(productRow.width) || 0,
          height: parseFloat(productRow.height) || 0,
          length_class_id: productRow.length_class_id,
          subtract: productRow.subtract === 1,
          minimum: productRow.minimum || 1,
          sort_order: productRow.sort_order || 0,
          status: productRow.status === 1,
          viewed: productRow.viewed || 0,
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
            sort_order: img.sort_order || 0
          })),
          
          attributes: attributes.map(attr => ({
            attribute_id: attr.attribute_id,
            attribute_group_id: attr.attribute_group_id,
            name: attr.attribute_name || 'Unknown Attribute',
            text: attr.text
          })),
          
          options: optionsWithValues,
          
          special_prices: specials.map(special => ({
            product_special_id: special.product_special_id,
            customer_group_id: special.customer_group_id,
            priority: special.priority || 0,
            price: parseFloat(special.price) || 0,
            date_start: special.date_start,
            date_end: special.date_end
          })),
          
          discounts: discounts.map(discount => ({
            product_discount_id: discount.product_discount_id,
            customer_group_id: discount.customer_group_id,
            quantity: discount.quantity || 0,
            priority: discount.priority || 0,
            price: parseFloat(discount.price) || 0,
            date_start: discount.date_start,
            date_end: discount.date_end
          })),
          
          related_products: relatedProducts.map(rel => rel.related_id),
          
          stores: [0], // Default store
          
          // Migration metadata
          original_mysql_id: productRow.product_id,
          migration_notes: [`Migrated on ${new Date().toISOString()}`]
        };

        documentsToInsert.push(productDocument);
        processedCount++;
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to prepare product ${productRow.product_id}: ${error.message}`);
        
        // Log first few detailed errors for debugging
        if (this.stats.failed <= 3) {
          console.error(`   🔍 Error details for product ${productRow.product_id}:`, error.message);
        }
      }
    }
    
    // Insert batch directly into MongoDB
    if (documentsToInsert.length > 0) {
      try {
        await productsCollection.insertMany(documentsToInsert, { ordered: false });
        this.stats.succeeded += documentsToInsert.length;
        
        console.log(`   ✅ Products: ${this.stats.succeeded}/${products.length} (batch ${Math.ceil((i + batchSize) / batchSize)})`);
      } catch (batchError) {
        console.error(`❌ Batch insert error: ${batchError.message}`);
        this.stats.failed += documentsToInsert.length;
      }
    }
  }
  
  console.log(`✅ Products migration: ${this.stats.succeeded}/${products.length} successful\n`);
  
  // Create indexes after insertion for better performance
  try {
    console.log('🔍 Creating indexes...');
    await productsCollection.createIndex({ product_id: 1 }, { unique: true });
    await productsCollection.createIndex({ model: 1 });
    await productsCollection.createIndex({ sku: 1 }, { sparse: true });
    await productsCollection.createIndex({ manufacturer_id: 1 });
    await productsCollection.createIndex({ price: 1 });
    await productsCollection.createIndex({ status: 1 });
    await productsCollection.createIndex({ date_added: 1 });
    await productsCollection.createIndex({
      'descriptions.name': 'text',
      'descriptions.description': 'text',
      model: 'text',
      sku: 'text'
    });
    console.log('✅ Indexes created successfully');
  } catch (indexError) {
    console.error(`⚠️ Index creation warning: ${indexError.message}`);
  }
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

        // Replace the migrateOrders method in your MigrationService with this version

// Replace the migrateOrders method with this robust version that handles duplicates

async migrateOrders() {
  console.log('🛒 Migrating orders directly to MongoDB (handling duplicates)...');
  
  const [orders] = await this.mysql.execute('SELECT * FROM oc_order ORDER BY order_id');
  
  console.log(`📊 Found ${orders.length} orders to migrate`);
  
  // Use direct MongoDB collections
  const ordersCollection = mongoose.connection.db.collection('orders');
  const orderProductsCollection = mongoose.connection.db.collection('order_products');
  
  // Clear existing data first (in case of re-run)
  console.log('🧹 Clearing existing order data...');
  await ordersCollection.deleteMany({});
  await orderProductsCollection.deleteMany({});
  
  // Drop existing indexes to avoid conflicts
  try {
    await ordersCollection.dropIndexes();
    await orderProductsCollection.dropIndexes();
  } catch (err) {
    console.log('   📝 No existing indexes to drop');
  }
  
  // Process in smaller batches for better error handling
  const batchSize = 50;
  let orderProductIdCounter = 1; // Track order_product_id to avoid duplicates
  
  for (let i = 0; i < orders.length; i += batchSize) {
    const batch = orders.slice(i, i + batchSize);
    const orderDocuments = [];
    const orderProductDocuments = [];
    
    for (const orderRow of batch) {
      try {
        this.stats.processed++;
        
        // Skip if order_id is null or duplicate
        if (!orderRow.order_id) {
          console.log(`   ⚠️  Skipping order with null order_id`);
          continue;
        }
        
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
          
          // Use our counter for order_product_id to avoid duplicates
          const uniqueOrderProductId = orderProductIdCounter++;
          
          const productWithOptions = {
            order_product_id: uniqueOrderProductId,
            product_id: product.product_id || 0,
            name: product.name || 'Unknown Product',
            model: product.model || '',
            quantity: product.quantity || 1,
            price: parseFloat(product.price) || 0,
            total: parseFloat(product.total) || 0,
            tax: parseFloat(product.tax) || 0,
            reward: product.reward || 0,
            options: options.map(opt => ({
              order_option_id: opt.order_option_id || 0,
              product_option_id: opt.product_option_id || 0,
              product_option_value_id: opt.product_option_value_id || 0,
              name: opt.name || '',
              value: opt.value || '',
              type: opt.type || 'text'
            }))
          };
          
          productsWithOptions.push(productWithOptions);
          
          // Also save to OrderProduct collection with unique ID
          orderProductDocuments.push({
            order_product_id: uniqueOrderProductId,
            original_order_product_id: product.order_product_id, // Keep original for reference
            order_id: orderRow.order_id,
            product_id: product.product_id || 0,
            name: product.name || 'Unknown Product',
            model: product.model || '',
            quantity: product.quantity || 1,
            price: parseFloat(product.price) || 0,
            total: parseFloat(product.total) || 0,
            tax: parseFloat(product.tax) || 0,
            reward: product.reward || 0,
            options: options.map(opt => ({
              order_option_id: opt.order_option_id || 0,
              product_option_id: opt.product_option_id || 0,
              product_option_value_id: opt.product_option_value_id || 0,
              name: opt.name || '',
              value: opt.value || '',
              type: opt.type || 'text'
            }))
          });
        }

        // Handle missing required fields with better defaults
        const firstname = orderRow.firstname || 'Guest';
        const lastname = orderRow.lastname || 'Customer';
        const email = orderRow.email || `guest_${orderRow.order_id}@example.com`;

        // Create order document with all fields properly handled
        const orderDocument = {
          order_id: orderRow.order_id,
          invoice_no: orderRow.invoice_no || 0,
          invoice_prefix: orderRow.invoice_prefix || '',
          store_id: orderRow.store_id || 0,
          store_name: orderRow.store_name || '',
          store_url: orderRow.store_url || '',
          customer_id: orderRow.customer_id || 0,
          customer_group_id: orderRow.customer_group_id || 1,
          firstname: firstname,
          lastname: lastname,
          email: email,
          telephone: orderRow.telephone || '',
          fax: orderRow.fax || '',
          custom_field: orderRow.custom_field || '',
          
          // Payment details
          payment_firstname: orderRow.payment_firstname || firstname,
          payment_lastname: orderRow.payment_lastname || lastname,
          payment_company: orderRow.payment_company || '',
          payment_address_1: orderRow.payment_address_1 || '',
          payment_address_2: orderRow.payment_address_2 || '',
          payment_city: orderRow.payment_city || '',
          payment_postcode: orderRow.payment_postcode || '',
          payment_country: orderRow.payment_country || '',
          payment_country_id: orderRow.payment_country_id || 0,
          payment_zone: orderRow.payment_zone || '',
          payment_zone_id: orderRow.payment_zone_id || 0,
          payment_address_format: orderRow.payment_address_format || '',
          payment_custom_field: orderRow.payment_custom_field || '',
          payment_method: orderRow.payment_method || 'Unknown',
          payment_code: orderRow.payment_code || '',
          
          // Shipping details
          shipping_firstname: orderRow.shipping_firstname || firstname,
          shipping_lastname: orderRow.shipping_lastname || lastname,
          shipping_company: orderRow.shipping_company || '',
          shipping_address_1: orderRow.shipping_address_1 || '',
          shipping_address_2: orderRow.shipping_address_2 || '',
          shipping_city: orderRow.shipping_city || '',
          shipping_postcode: orderRow.shipping_postcode || '',
          shipping_country: orderRow.shipping_country || '',
          shipping_country_id: orderRow.shipping_country_id || 0,
          shipping_zone: orderRow.shipping_zone || '',
          shipping_zone_id: orderRow.shipping_zone_id || 0,
          shipping_address_format: orderRow.shipping_address_format || '',
          shipping_custom_field: orderRow.shipping_custom_field || '',
          shipping_method: orderRow.shipping_method || 'Unknown',
          shipping_code: orderRow.shipping_code || '',
          
          comment: orderRow.comment || '',
          total: parseFloat(orderRow.total) || 0,
          order_status_id: orderRow.order_status_id || 1,
          affiliate_id: orderRow.affiliate_id || 0,
          commission: parseFloat(orderRow.commission) || 0,
          tracking: orderRow.tracking || '',
          language_id: orderRow.language_id || 1,
          currency_id: orderRow.currency_id || 1,
          currency_code: orderRow.currency_code || 'USD',
          currency_value: parseFloat(orderRow.currency_value) || 1,
          ip: orderRow.ip || '',
          forwarded_ip: orderRow.forwarded_ip || '',
          user_agent: orderRow.user_agent || '',
          accept_language: orderRow.accept_language || '',
          date_added: orderRow.date_added || new Date(),
          date_modified: orderRow.date_modified || new Date(),
          
          // Embedded products
          products: productsWithOptions,
          
          // Migration metadata
          original_mysql_id: orderRow.order_id,
          migration_notes: [`Migrated on ${new Date().toISOString()}`]
        };

        orderDocuments.push(orderDocument);
        
      } catch (error) {
        this.stats.failed++;
        console.error(`❌ Failed to prepare order ${orderRow.order_id}: ${error.message}`);
        
        // Log first few detailed errors for debugging
        if (this.stats.failed <= 5) {
          console.error(`   🔍 Error details for order ${orderRow.order_id}:`, error.message);
        }
      }
    }
    
    // Insert batch of orders with better error handling
    if (orderDocuments.length > 0) {
      try {
        const result = await ordersCollection.insertMany(orderDocuments, { 
          ordered: false,
          writeConcern: { w: 1 }
        });
        this.stats.succeeded += result.insertedCount;
      } catch (batchError) {
        // Handle individual document errors
        if (batchError.writeErrors) {
          const successCount = orderDocuments.length - batchError.writeErrors.length;
          this.stats.succeeded += successCount;
          this.stats.failed += batchError.writeErrors.length;
          
          console.error(`❌ ${batchError.writeErrors.length} orders failed in batch, ${successCount} succeeded`);
          
          // Log first few errors
          batchError.writeErrors.slice(0, 3).forEach(err => {
            console.error(`   Error: ${err.errmsg}`);
          });
        } else {
          console.error(`❌ Orders batch insert error: ${batchError.message}`);
          this.stats.failed += orderDocuments.length;
        }
      }
    }
    
    // Insert batch of order products with error handling
    if (orderProductDocuments.length > 0) {
      try {
        await orderProductsCollection.insertMany(orderProductDocuments, { 
          ordered: false,
          writeConcern: { w: 1 }
        });
      } catch (batchError) {
        console.error(`❌ Order products batch insert error: ${batchError.message}`);
      }
    }
    
    // Progress update
    if (i % (batchSize * 20) === 0 || i + batchSize >= orders.length) {
      console.log(`   ✅ Orders: ${this.stats.succeeded}/${orders.length} (${((this.stats.succeeded / orders.length) * 100).toFixed(1)}%)`);
    }
  }
  
  console.log(`✅ Orders migration: ${this.stats.succeeded}/${orders.length} successful\n`);
  
  // Create indexes after insertion
  try {
    console.log('🔍 Creating order indexes...');
    
    await ordersCollection.createIndex({ order_id: 1 }, { unique: true });
    await ordersCollection.createIndex({ customer_id: 1, date_added: -1 });
    await ordersCollection.createIndex({ order_status_id: 1 });
    await ordersCollection.createIndex({ date_added: -1 });
    await ordersCollection.createIndex({ email: 1 });
    
    await orderProductsCollection.createIndex({ order_product_id: 1 }, { unique: true });
    await orderProductsCollection.createIndex({ order_id: 1 });
    await orderProductsCollection.createIndex({ product_id: 1 });
    
    console.log('✅ Order indexes created successfully');
  } catch (indexError) {
    console.error(`⚠️ Order index creation warning: ${indexError.message}`);
  }
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