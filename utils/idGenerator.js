// utils/idGenerator.js - PRODUCTION READY ID GENERATION SERVICE

import mongoose from 'mongoose';
import Customer from '../models/customer.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';

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
  }

  // Initialize counters from existing data (run once on server startup)
  async initialize() {
    if (this.initialized) return;
    
    try {
      console.log('🔄 Initializing ID generation service...');
      
      const entities = [
        { name: 'customer', Model: Customer },
        { name: 'product', Model: Product },
        { name: 'order', Model: Order }
      ];

      for (const entity of entities) {
        await this.initializeEntityCounter(entity.name, entity.Model);
      }

      this.initialized = true;
      console.log('✅ ID generation service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize ID service:', error);
      throw error;
    }
  }

  // Initialize counter for specific entity
  async initializeEntityCounter(entityName, Model) {
    try {
      const idField = `${entityName}_id`;
      
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

      console.log(`   ✅ ${entityName}: max ID = ${currentMax}, next = ${currentMax + 1}`);
    } catch (error) {
      console.error(`   ❌ Failed to initialize ${entityName}:`, error);
      throw error;
    }
  }

  // Get next ID for any entity (MAIN METHOD)
  async getNextId(entityName) {
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

export const getNextAddressId = async (customer) => {
  // For embedded addresses, calculate within customer document
  if (!customer.addresses || customer.addresses.length === 0) {
    return 1;
  }
  
  const maxId = Math.max(...customer.addresses.map(addr => addr.address_id || 0));
  return maxId + 1;
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

export default idGenerator;