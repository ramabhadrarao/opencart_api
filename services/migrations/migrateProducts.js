// services/migrations/migrateProducts.js (optimized)
import { BatchMigrator } from '../batchMigrator.js';
import Product from '../../models/product.model.js';

export const migrateProducts = async () => {
  const transformer = async (product, mysql) => {
    // Get descriptions (in a single query)
    const [descriptions] = await mysql.execute(
      'SELECT * FROM oc_product_description WHERE product_id = ?', 
      [product.product_id]
    );
    
    // Get categories, stores, images - all in parallel
    const [categoriesPromise, storesPromise, imagesPromise, attributesPromise, optionsPromise, 
          discountsPromise, specialsPromise, downloadsPromise, relatedPromise] = [
      mysql.execute('SELECT category_id FROM oc_product_to_category WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT store_id FROM oc_product_to_store WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT * FROM oc_product_image WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT * FROM oc_product_attribute WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT * FROM oc_product_option WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT * FROM oc_product_discount WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT * FROM oc_product_special WHERE product_id = ?', [product.product_id]),
      mysql.execute('SELECT d.* FROM oc_product_to_download pd JOIN oc_download d ON pd.download_id = d.download_id WHERE pd.product_id = ?', [product.product_id]),
      mysql.execute('SELECT related_id FROM oc_product_related WHERE product_id = ?', [product.product_id])
    ];
    
    // Wait for all parallel queries
    const [categoriesResult, storesResult, imagesResult, attributesResult, optionsResult,
          discountsResult, specialsResult, downloadsResult, relatedResult] = await Promise.all([
      categoriesPromise, storesPromise, imagesPromise, attributesPromise, optionsPromise,
      discountsPromise, specialsPromise, downloadsPromise, relatedPromise
    ]);
    
    const [categories] = categoriesResult;
    const [stores] = storesResult;
    const [images] = imagesResult;
    const [attributes] = attributesResult;
    const [productOptions] = optionsResult;
    const [discounts] = discountsResult;
    const [specials] = specialsResult;
    const [downloads] = downloadsResult;
    const [related] = relatedResult;
    
    // Process attributes
    const processedAttributes = [];
    for (const attr of attributes) {
      const [attrDetails] = await mysql.execute(
        'SELECT ad.name, ag.attribute_group_id FROM oc_attribute a ' +
        'JOIN oc_attribute_description ad ON a.attribute_id = ad.attribute_id ' +
        'JOIN oc_attribute_group ag ON a.attribute_group_id = ag.attribute_group_id ' +
        'WHERE a.attribute_id = ? AND ad.language_id = 1',
        [attr.attribute_id]
      );
      
      if (attrDetails.length) {
        processedAttributes.push({
          attribute_id: attr.attribute_id,
          attribute_group_id: attrDetails[0].attribute_group_id,
          name: attrDetails[0].name,
          text: attr.text
        });
      }
    }
    
    // Process options and option values
    const processedOptions = [];
    for (const po of productOptions) {
      const [optionDetails] = await mysql.execute(
        'SELECT od.name, o.type FROM oc_option o ' +
        'JOIN oc_option_description od ON o.option_id = od.option_id ' +
        'WHERE o.option_id = ? AND od.language_id = 1',
        [po.option_id]
      );
      
      const [optionValues] = await mysql.execute(
        'SELECT pov.*, ovd.name FROM oc_product_option_value pov ' +
        'JOIN oc_option_value_description ovd ON pov.option_value_id = ovd.option_value_id ' +
        'WHERE pov.product_option_id = ? AND ovd.language_id = 1',
        [po.product_option_id]
      );
      
      processedOptions.push({
        product_option_id: po.product_option_id,
        option_id: po.option_id,
        name: optionDetails[0]?.name || '',
        type: optionDetails[0]?.type || '',
        required: po.required === 1,
        values: optionValues.map(ov => ({
          product_option_value_id: ov.product_option_value_id,
          option_value_id: ov.option_value_id,
          name: ov.name,
          quantity: ov.quantity,
          subtract: ov.subtract === 1,
          price: ov.price,
          price_prefix: ov.price_prefix,
          weight: ov.weight,
          weight_prefix: ov.weight_prefix,
          uploaded_file: ov.uploaded_files || ''
        }))
      });
    }
    
    // Create document
    return {
      product_id: product.product_id,
      model: product.model,
      sku: product.sku,
      upc: product.upc,
      ean: product.ean,
      jan: product.jan,
      isbn: product.isbn,
      mpn: product.mpn,
      location: product.location,
      quantity: product.quantity,
      stock_status_id: product.stock_status_id,
      image: product.image,
      manufacturer_id: product.manufacturer_id,
      shipping: product.shipping === 1,
      price: product.price,
      points: product.points,
      tax_class_id: product.tax_class_id,
      date_available: product.date_available,
      weight: product.weight,
      weight_class_id: product.weight_class_id,
      length: product.length,
      width: product.width,
      height: product.height,
      length_class_id: product.length_class_id,
      subtract: product.subtract === 1,
      minimum: product.minimum,
      sort_order: product.sort_order,
      status: product.status === 1,
      viewed: product.viewed,
      date_added: product.date_added,
      date_modified: product.date_modified,
      
      // Embedded documents
      descriptions: descriptions.map(d => ({
        language_id: d.language_id,
        name: d.name,
        description: d.description,
        tag: d.tag,
        meta_title: d.meta_title,
        meta_description: d.meta_description,
        meta_keyword: d.meta_keyword
      })),
      
      categories: categories.map(c => c.category_id),
      stores: stores.map(s => s.store_id),
      
      additional_images: images.map(img => ({
        product_image_id: img.product_image_id,
        image: img.image,
        sort_order: img.sort_order
      })),
      
      attributes: processedAttributes,
      options: processedOptions,
      
      discounts: discounts.map(d => ({
        product_discount_id: d.product_discount_id,
        quantity: d.quantity,
        priority: d.priority,
        price: d.price,
        date_start: d.date_start,
        date_end: d.date_end
      })),
      
      special_prices: specials.map(s => ({
        product_special_id: s.product_special_id,
        customer_group_id: s.customer_group_id,
        priority: s.priority,
        price: s.price,
        date_start: s.date_start,
        date_end: s.date_end
      })),
      
      downloads: downloads.map(d => ({
        download_id: d.download_id,
        name: d.name,
        filename: d.filename,
        mask: d.mask,
        remaining: d.remaining
      })),
      
      related_products: related.map(r => r.related_id)
    };
  };

  const migrator = new BatchMigrator({
    tableName: 'oc_product',
    modelName: 'Product',
    transformer,
    idField: 'product_id',
    batchSize: 50
  });
  
  return migrator.run();
};