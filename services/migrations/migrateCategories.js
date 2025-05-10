// services/migrations/migrateCategories.js
import { connectMySQL } from '../../config/db.js';
import Category from '../../models/category.model.js';

export const migrateCategories = async () => {
  const mysql = await connectMySQL();
  console.log('🔎 Checking existing categories...');

  const existingCount = await Category.countDocuments();
  if (existingCount > 0) {
    console.log('✅ Categories already migrated. Skipping...');
    await mysql.end();
    return;
  }

  console.log('📦 Migrating categories...');
  const [categories] = await mysql.execute('SELECT * FROM oc_category');

  for (const category of categories) {
    try {
      // Get descriptions
      const [descriptions] = await mysql.execute(
        'SELECT * FROM oc_category_description WHERE category_id = ?', 
        [category.category_id]
      );
      
      // Get path
      const [paths] = await mysql.execute(
        'SELECT * FROM oc_category_path WHERE category_id = ? ORDER BY level', 
        [category.category_id]
      );
      
      await Category.create({
        category_id: category.category_id,
        parent_id: category.parent_id,
        image: category.image,
        top: category.top === 1,
        column: category.column,
        sort_order: category.sort_order,
        status: category.status === 1,
        date_added: category.date_added,
        date_modified: category.date_modified,
        descriptions: descriptions.map(d => ({
          language_id: d.language_id,
          name: d.name,
          description: d.description,
          meta_title: d.meta_title,
          meta_description: d.meta_description,
          meta_keyword: d.meta_keyword
        })),
        path: paths.map(p => p.path_id)
      });

      console.log(`✅ Category #${category.category_id} (${descriptions[0]?.name || 'Unnamed'}) migrated`);
    } catch (error) {
      console.error(`❌ Error migrating category #${category.category_id}:`, error.message);
    }
  }

  await mysql.end();
  console.log('🎉 Category migration completed!');
};