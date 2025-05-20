// services/migrations/migrateOrders.js
import { BatchMigrator } from '../batchMigrator.js';
import Order from '../../models/order.model.js';

export const migrateOrders = async () => {
  const transformer = async (order, mysql) => {
    try {
      // Get order products, totals, and history in parallel for efficiency
      const [productsPromise, totalsPromise, historyPromise] = [
        mysql.execute('SELECT * FROM oc_order_product WHERE order_id = ?', [order.order_id]),
        mysql.execute('SELECT * FROM oc_order_total WHERE order_id = ?', [order.order_id]),
        mysql.execute('SELECT * FROM oc_order_history WHERE order_id = ?', [order.order_id])
      ];
      
      // Wait for all queries to complete
      const [productsResult, totalsResult, historyResult] = await Promise.all([
        productsPromise, totalsPromise, historyPromise
      ]);
      
      const [products] = productsResult;
      const [totals] = totalsResult;
      const [history] = historyResult;
      
      // Create order document with all required fields
      return {
        order_id: order.order_id,
        invoice_no: order.invoice_no,
        invoice_prefix: order.invoice_prefix,
        store_id: order.store_id,
        store_name: order.store_name,
        store_url: order.store_url,
        customer_id: order.customer_id,
        customer_group_id: order.customer_group_id,
        firstname: order.firstname,
        lastname: order.lastname,
        email: order.email,
        telephone: order.telephone,
        fax: order.fax,
        custom_field: tryParseJson(order.custom_field),
        
        // Payment details
        payment_firstname: order.payment_firstname,
        payment_lastname: order.payment_lastname,
        payment_company: order.payment_company,
        payment_address_1: order.payment_address_1,
        payment_address_2: order.payment_address_2,
        payment_city: order.payment_city,
        payment_postcode: order.payment_postcode,
        payment_country: order.payment_country,
        payment_country_id: order.payment_country_id,
        payment_zone: order.payment_zone,
        payment_zone_id: order.payment_zone_id,
        payment_address_format: order.payment_address_format,
        payment_custom_field: tryParseJson(order.payment_custom_field),
        payment_method: order.payment_method,
        payment_code: order.payment_code,
        
        // Shipping details
        shipping_firstname: order.shipping_firstname,
        shipping_lastname: order.shipping_lastname,
        shipping_company: order.shipping_company,
        shipping_address_1: order.shipping_address_1,
        shipping_address_2: order.shipping_address_2,
        shipping_city: order.shipping_city,
        shipping_postcode: order.shipping_postcode,
        shipping_country: order.shipping_country,
        shipping_country_id: order.shipping_country_id,
        shipping_zone: order.shipping_zone,
        shipping_zone_id: order.shipping_zone_id,
        shipping_address_format: order.shipping_address_format,
        shipping_custom_field: tryParseJson(order.shipping_custom_field),
        shipping_method: order.shipping_method,
        shipping_code: order.shipping_code,
        
        comment: order.comment,
        total: parseFloat(order.total),
        order_status_id: order.order_status_id,
        affiliate_id: order.affiliate_id,
        commission: parseFloat(order.commission || 0),
        marketing_id: order.marketing_id,
        tracking: order.tracking,
        language_id: order.language_id,
        currency_id: order.currency_id,
        currency_code: order.currency_code,
        currency_value: parseFloat(order.currency_value),
        ip: order.ip,
        forwarded_ip: order.forwarded_ip,
        user_agent: order.user_agent,
        accept_language: order.accept_language,
        date_added: order.date_added,
        date_modified: order.date_modified,
        
        // Embedded order products
        products: products.map(p => ({
          order_product_id: p.order_product_id,
          product_id: p.product_id,
          name: p.name,
          model: p.model,
          quantity: p.quantity,
          price: parseFloat(p.price),
          total: parseFloat(p.total),
          tax: parseFloat(p.tax || 0),
          reward: p.reward
        })),
        
        // Order totals breakdown
        totals: totals.map(t => ({
          order_total_id: t.order_total_id,
          code: t.code,
          title: t.title,
          value: parseFloat(t.value),
          sort_order: t.sort_order
        })),
        
        // Order history
        history: history.map(h => ({
          order_history_id: h.order_history_id,
          order_status_id: h.order_status_id,
          notify: h.notify === 1,
          comment: h.comment,
          date_added: h.date_added
        }))
      };
    } catch (error) {
      console.error(`Error transforming order ${order.order_id}:`, error.message);
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

  const migrator = new BatchMigrator({
    tableName: 'oc_order',
    modelName: 'Order',
    transformer,
    idField: 'order_id',
    batchSize: 100
  });
  
  return migrator.run();
};