// services/migrations/migrateCoupons.js
import { BatchMigrator } from '../batchMigrator.js';
import Coupon from '../../models/coupon.model.js';

export const migrateCoupons = async () => {
  const transformer = async (coupon, mysql) => {
    try {
      // Get coupon categories, products, and history in parallel
      const [categoriesPromise, productsPromise, historyPromise] = [
        mysql.execute('SELECT category_id FROM oc_coupon_category WHERE coupon_id = ?', [coupon.coupon_id]),
        mysql.execute('SELECT product_id FROM oc_coupon_product WHERE coupon_id = ?', [coupon.coupon_id]),
        mysql.execute('SELECT * FROM oc_coupon_history WHERE coupon_id = ?', [coupon.coupon_id])
      ];
      
      // Wait for all queries to complete
      const [categoriesResult, productsResult, historyResult] = await Promise.all([
        categoriesPromise, productsPromise, historyPromise
      ]);
      
      const [categories] = categoriesResult;
      const [products] = productsResult;
      const [history] = historyResult;
      
      return {
        coupon_id: coupon.coupon_id,
        name: coupon.name,
        code: coupon.code,
        type: coupon.type,
        discount: parseFloat(coupon.discount),
        logged: coupon.logged === 1,
        shipping: coupon.shipping === 1,
        total: parseFloat(coupon.total),
        date_start: coupon.date_start,
        date_end: coupon.date_end,
        uses_total: coupon.uses_total,
        uses_customer: coupon.uses_customer,
        status: coupon.status === 1,
        date_added: coupon.date_added,
        
        // Relations
        categories: categories.map(cat => cat.category_id),
        products: products.map(prod => prod.product_id),
        
        // History
        history: history.map(h => ({
          order_id: h.order_id,
          customer_id: h.customer_id,
          amount: parseFloat(h.amount),
          date_added: h.date_added
        }))
      };
    } catch (error) {
      console.error(`Error transforming coupon ${coupon.coupon_id}:`, error.message);
      throw error;
    }
  };

  const migrator = new BatchMigrator({
    tableName: 'oc_coupon',
    modelName: 'Coupon',
    transformer,
    idField: 'coupon_id',
    batchSize: 50
  });
  
  return migrator.run();
};