// utils/idGenerator.js - ENHANCED FOR ALL MIGRATED MODELS

import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';
import Category from '../models/category.model.js';
import Admin from '../models/admin.model.js';
import Country from '../models/country.model.js';
import Zone from '../models/zone.model.js';
import Address from '../models/address.model.js';
import Review from '../models/review.model.js';
import Coupon from '../models/coupon.model.js';
import Wishlist from '../models/wishlist.model.js' ; // Wishlist uses customer_id as unique, no separate ID needed  
import Manufacturer from '../models/manufacturer.model.js';

// Counter model for atomic ID generation
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },  // Entity name (customer_id, product_id, etc.)
  sequence_value: { type: Number, default: 0 }
}, { collection: 'counters' });

const Counter = mongoose.model('Counter', counterSchema);

class IdGeneratorService {
  constructor() {
    this.initialized = false;
    this.fallbackCache = new Map();
    
    // Define all entities that need ID generation
    this.entities = [
      { name: 'customer', Model: Customer, field: 'customer_id' },
      { name: 'product', Model: Product, field: 'product_id' },
      { name: 'order', Model: Order, field: 'order_id' },
      { name: 'order_product', Model: OrderProduct, field: 'order_product_id' },
      { name: 'category', Model: Category, field: 'category_id' },
      { name: 'manufacturer', Model: Manufacturer, field: 'manufacturer_id' },
      { name: 'admin', Model: Admin, field: 'user_id' },
      { name: 'country', Model: Country, field: 'country_id' },
      { name: 'zone', Model: Zone, field: 'zone_id' },
      { name: 'address', Model: Address, field: 'address_id' },
      { name: 'review', Model: Review, field: 'review_id' },
      { name: 'coupon', Model: Coupon, field: 'coupon_id' }
      // Note: wishlist uses customer_id as unique, no separate ID needed
    ];
  }

  // Initialize counters from existing data (run once on server startup)
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔄 Initializing ID generation service...');
      
      for (const entity of this.entities) {
        await this.initializeEntityCounter(entity.name, entity.Model, entity.field);
      }

      this.initialized = true;
      console.log('✅ ID generation service initialized successfully');
      
      // Show current status
      const status = await this.getCounterStatus();
      console.log('📊 Counter Status:', status);
    } catch (error) {
      console.error('❌ Failed to initialize ID service:', error);
      throw error;
    }
  }

  // Initialize counter for specific entity
  async initializeEntityCounter(entityName, Model, idField) {
    try {
      // Find highest existing ID
      const lastDoc = await Model.findOne()
        .sort({ [idField]: -1 })
        .select(idField)
        .lean();

      const currentMax = lastDoc ? lastDoc[idField] : 0;

      // Set counter to current max (next ID will be max + 1)
      await Counter.findByIdAndUpdate(
        `${entityName}_id`,
        { sequence_value: currentMax },
        { upsert: true }
      );

      console.log(`   ✅ ${entityName}: max ${idField} = ${currentMax}, next = ${currentMax + 1}`);
    } catch (error) {
      console.error(`   ❌ Failed to initialize ${entityName}:`, error);
      throw error;
    }
  }

  // Get next ID for any entity (MAIN METHOD)
  async getNextId(entityName) {
    if (!this.initialized) {
      console.warn('⚠️ ID Generator not initialized, attempting to initialize...');
      await this.initialize();
    }

    try {
      // Try atomic counter approach first
      const nextId = await this.getAtomicId(entityName);
      
      // Fallback cache update
      this.fallbackCache.set(entityName, nextId);
      
      return nextId;
    } catch (error) {
      console.error(`Error generating ${entityName} ID:`, error);
      
      // Emergency fallback
      return await this.getFallbackId(entityName);
    }
  }

  // Atomic counter-based ID generation
  async getAtomicId(entityName) {
    const counter = await Counter.findByIdAndUpdate(
      `${entityName}_id`,
      { $inc: { sequence_value: 1 } },
      { 
        new: true,           // Return updated document
        upsert: true,        // Create if doesn't exist
        runValidators: true
      }
    );

    return counter.sequence_value;
  }

  // Emergency fallback if counter fails
  async getFallbackId(entityName) {
    console.warn(`⚠️ Using fallback ID generation for ${entityName}`);
    
    const cached = this.fallbackCache.get(entityName) || 0;
    const nextId = cached + 1;
    this.fallbackCache.set(entityName, nextId);
    
    return nextId;
  }

  // Get current counter values (for debugging)
  async getCounterStatus() {
    const counters = await Counter.find({}).lean();
    return counters.reduce((acc, counter) => {
      acc[counter._id] = {
        current: counter.sequence_value,
        next: counter.sequence_value + 1
      };
      return acc;
    }, {});
  }

  // Reset counter (admin only)
  async resetCounter(entityName, value) {
    await Counter.findByIdAndUpdate(
      `${entityName}_id`,
      { sequence_value: value },
      { upsert: true }
    );
    
    console.log(`🔄 Reset ${entityName} counter to ${value}`);
  }

  // Batch reserve IDs for bulk operations
  async reserveIds(entityName, count) {
    const counter = await Counter.findByIdAndUpdate(
      `${entityName}_id`,
      { $inc: { sequence_value: count } },
      { 
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    // Return array of reserved IDs
    const endId = counter.sequence_value;
    const startId = endId - count + 1;
    
    return Array.from({ length: count }, (_, i) => startId + i);
  }
}

// Create singleton instance
const idGenerator = new IdGeneratorService();

// Export convenience methods for each entity
export const getNextCustomerId = async () => {
  return await idGenerator.getNextId('customer');
};

export const getNextProductId = async () => {
  return await idGenerator.getNextId('product');
};

export const getNextOrderId = async () => {
  return await idGenerator.getNextId('order');
};

export const getNextOrderProductId = async () => {
  return await idGenerator.getNextId('order_product');
};

export const getNextCategoryId = async () => {
  return await idGenerator.getNextId('category');
};

export const getNextAdminId = async () => {
  return await idGenerator.getNextId('admin');
};

export const getNextCountryId = async () => {
  return await idGenerator.getNextId('country');
};

export const getNextZoneId = async () => {
  return await idGenerator.getNextId('zone');
};

export const getNextAddressId = async (customer = null) => {
  // For embedded addresses, calculate within customer document
  if (customer && customer.addresses && customer.addresses.length > 0) {
    const maxId = Math.max(...customer.addresses.map(addr => addr.address_id || 0));
    return maxId + 1;
  }
  
  // For standalone address collection
  return await idGenerator.getNextId('address');
};

export const getNextReviewId = async () => {
  return await idGenerator.getNextId('review');
};

export const getNextCouponId = async () => {
  return await idGenerator.getNextId('coupon');
};

// Batch operations
export const reserveCustomerIds = async (count) => {
  return await idGenerator.reserveIds('customer', count);
};

export const reserveProductIds = async (count) => {
  return await idGenerator.reserveIds('product', count);
};

export const reserveOrderIds = async (count) => {
  return await idGenerator.reserveIds('order', count);
};

// Export service instance and initialization
export const initializeIdService = async () => {
  await idGenerator.initialize();
};

export const getIdCounterStatus = async () => {
  return await idGenerator.getCounterStatus();
};

export const resetIdCounter = async (entityName, value) => {
  return await idGenerator.resetCounter(entityName, value);
};
export const getNextManufacturerId = async () => {
  return await idGenerator.getNextId('manufacturer');
};


export default idGenerator;