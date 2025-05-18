// services/migrations/migrateAdmins.js
import { connectMySQL } from '../../config/db.js';
import Admin from '../../models/admin.model.js';

export const migrateAdmins = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing admins...');

  const existingCount = await Admin.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Admins already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating admins...');
  const [rows] = await mysql.execute('SELECT * FROM oc_user');

  for (const row of rows) {
    try {
      await Admin.create({
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

      console.log(`➡️ Admin: ${row.username}`);
    } catch (err) {
      console.error(`❌ Error migrating admin ${row.username}: ${err.message}`);
    }
  }

  await mysql.end();
  console.log('✅ Admin migration completed!');
};