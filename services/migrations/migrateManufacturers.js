// services/migrations/migrateManufacturers.js
import { connectMySQL } from '../../config/db.js';
import Manufacturer from '../../models/manufacturer.model.js';

export const migrateManufacturers = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing manufacturers...');

  const existingCount = await Manufacturer.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Manufacturers already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating manufacturers...');
  const [manufacturers] = await mysql.execute('SELECT * FROM oc_manufacturer');

  for (const manufacturer of manufacturers) {
    try {
      await Manufacturer.create({
        manufacturer_id: manufacturer.manufacturer_id,
        name: manufacturer.name,
        image: manufacturer.image,
        sort_order: manufacturer.sort_order
      });

      console.log(`➡️  Manufacturer #${manufacturer.manufacturer_id} (${manufacturer.name}) migrated`);
    } catch (error) {
      console.error(`❌ Error migrating manufacturer #${manufacturer.manufacturer_id}:`, error.message);
    }
  }

  await mysql.end();
  console.log('🎉 Manufacturers migration completed!');
};