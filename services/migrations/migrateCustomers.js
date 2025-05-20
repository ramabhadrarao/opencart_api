// services/migrations/migrateCustomers.js
// services/migrations/migrateCustomers.js
import { BatchMigrator } from '../batchMigrator.js';
import Customer from '../../models/customer.model.js';
import mongoose from 'mongoose';

export const migrateCustomers = async () => {
  // Keep track of customers without proper address_id
  const noAddressCustomers = [];
  
  const transformer = async (customer, mysql) => {
    try {
      // Get customer addresses
      const [addresses] = await mysql.execute(
        'SELECT * FROM oc_address WHERE customer_id = ?', 
        [customer.customer_id]
      );
      
      // Get customer wishlist
      const [wishlist] = await mysql.execute(
        'SELECT product_id FROM oc_customer_wishlist WHERE customer_id = ?',
        [customer.customer_id]
      );
      
      // Get customer activity counts
      const [activities] = await mysql.execute(
        'SELECT COUNT(*) as count FROM oc_customer_activity WHERE customer_id = ?',
        [customer.customer_id]
      );
      
      // Get login count
      const [logins] = await mysql.execute(
        'SELECT COUNT(*) as count FROM oc_customer_ip WHERE customer_id = ?',
        [customer.customer_id]
      );
      
      // Process addresses with proper handling for null/missing values
      const processedAddresses = [];
      
      if (addresses && addresses.length > 0) {
        // Filter out any addresses with null address_id
        const validAddresses = addresses.filter(addr => addr.address_id != null);
        
        for (const address of validAddresses) {
          processedAddresses.push({
            address_id: parseInt(address.address_id), // Ensure it's a number
            firstname: address.firstname || '',
            lastname: address.lastname || '',
            company: address.company || '',
            address_1: address.address_1 || '',
            address_2: address.address_2 || '',
            city: address.city || '',
            postcode: address.postcode || '',
            country_id: parseInt(address.country_id) || 0,
            zone_id: parseInt(address.zone_id) || 0,
            custom_field: tryParseJson(address.custom_field)
          });
        }
      }
      
      // If customer has no valid addresses, track for reporting
      if (processedAddresses.length === 0) {
        noAddressCustomers.push(customer.customer_id);
      }
      
      // Determine address_id value (default to 0 if no valid addresses)
      let addressId = parseInt(customer.address_id) || 0;
      
      // If address_id is invalid but customer has addresses, use the first address ID
      if ((addressId === 0 || isNaN(addressId)) && processedAddresses.length > 0) {
        addressId = processedAddresses[0].address_id;
      }
      
      return {
        customer_id: parseInt(customer.customer_id),
        customer_group_id: parseInt(customer.customer_group_id) || 1,
        store_id: parseInt(customer.store_id) || 0,
        language_id: parseInt(customer.language_id) || 1,
        firstname: customer.firstname || '',
        lastname: customer.lastname || '',
        email: customer.email || '',
        telephone: customer.telephone || '',
        fax: customer.fax || '',
        password: customer.password || '',
        salt: customer.salt || '',
        cart: tryParseJson(customer.cart),
        wishlist: wishlist ? wishlist.map(item => parseInt(item.product_id)) : [],
        newsletter: customer.newsletter === 1,
        address_id: addressId,
        custom_field: tryParseJson(customer.custom_field),
        ip: customer.ip || '',
        status: customer.status === 1,
        safe: customer.safe === 1,
        token: customer.token || '',
        code: customer.code || '',
        date_added: customer.date_added || new Date(),
        
        // Additional tracking fields
        total_logins: logins && logins[0] ? parseInt(logins[0].count) || 0 : 0,
        total_activities: activities && activities[0] ? parseInt(activities[0].count) || 0 : 0,
        
        // Addresses (embedded for better performance)
        addresses: processedAddresses
      };
    } catch (error) {
      console.error(`Error transforming customer ${customer.customer_id}:`, error.message);
      throw error;
    }
  };
  
  // Helper function to try parsing JSON
  function tryParseJson(jsonString) {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      return jsonString;
    }
  }

  // First update the Customer model schema to drop the unique index on addresses.address_id
  try {
    // Check if index exists and drop it
    const model = mongoose.model('Customer');
    const collection = model.collection;
    const indexes = await collection.indexes();
    const addressIndex = indexes.find(idx => 
      idx.name === 'addresses.address_id_1' || 
      (idx.key && idx.key['addresses.address_id'])
    );
    
    if (addressIndex) {
      console.log('🔄 Dropping unique index on addresses.address_id...');
      await collection.dropIndex(addressIndex.name);
      console.log('✅ Index dropped successfully');
    }
  } catch (error) {
    console.log('⚠️ Could not drop index (might not exist yet):', error.message);
    // Continue with migration even if index drop fails
  }

  const migrator = new BatchMigrator({
    tableName: 'oc_customer',
    modelName: 'Customer',
    transformer,
    idField: 'customer_id',
    batchSize: 200,
    continueOnError: true // Continue migration even if some customers fail
  });
  
  const result = await migrator.run();
  
  // Report on customers without addresses
  console.log(`ℹ️ Found ${noAddressCustomers.length} customers without addresses`);
  if (noAddressCustomers.length > 0) {
    console.log(`📊 First 10 customer IDs without addresses: ${noAddressCustomers.slice(0, 10).join(', ')}${noAddressCustomers.length > 10 ? '...' : ''}`);
  }
  
  return result;
};