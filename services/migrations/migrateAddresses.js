// services/migrations/migrateAddresses.js
import { connectMySQL } from '../../config/db.js';
import Address from '../../models/address.model.js';

export const migrateAddresses = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing addresses...');

  const existingCount = await Address.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Addresses already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating addresses...');
  const [addresses] = await mysql.execute('SELECT * FROM oc_address');

  for (const address of addresses) {
    try {
      await Address.create({
        address_id: address.address_id,
        customer_id: address.customer_id,
        firstname: address.firstname,
        lastname: address.lastname,
        company: address.company,
        address_1: address.address_1,
        address_2: address.address_2,
        city: address.city,
        postcode: address.postcode,
        country_id: address.country_id,
        zone_id: address.zone_id,
        custom_field: address.custom_field
      });

      console.log(`➡️  Address #${address.address_id}`);
    } catch (error) {
      console.error(`❌ Error migrating address #${address.address_id}:`, error.message);
    }
  }

  await mysql.end();
  console.log('🎉 Address migration completed!');
};