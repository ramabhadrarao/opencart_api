// controllers/system.controller.js (New System Status Controller)
import mongoose from 'mongoose';
import { getIdCounterStatus } from '../utils/idGenerator.js';

// Get system overview
export const getSystemOverview = async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    // Database status
    const dbStatus = mongoose.connection.readyState;
    const dbStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    // Get collection stats
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const collectionStats = {};
    let totalDocuments = 0;
    let totalIndexes = 0;
    
    for (const collection of collections) {
      try {
        const stats = await db.collection(collection.name).stats();
        const indexes = await db.collection(collection.name).indexes();
        
        collectionStats[collection.name] = {
          count: stats.count,
          size: stats.size,
          avgObjSize: stats.avgObjSize,
          indexes: indexes.length
        };
        
        totalDocuments += stats.count;
        totalIndexes += indexes.length;
      } catch (err) {
        collectionStats[collection.name] = {
          count: 0,
          size: 0,
          avgObjSize: 0,
          indexes: 0,
          error: err.message
        };
      }
    }
    
    // Get ID counter status
    const counterStatus = await getIdCounterStatus();
    
    // Server info
    const serverInfo = {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      pid: process.pid
    };
    
    res.json({
      database: {
        status: dbStates[dbStatus],
        name: db.databaseName,
        total_collections: collections.length,
        total_documents: totalDocuments,
        total_indexes: totalIndexes
      },
      collections: collectionStats,
      id_counters: counterStatus,
      server: serverInfo,
      timestamp: new Date()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching system overview', error: err.message });
  }
};

// Get database health check
export const getHealthCheck = async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date(),
      services: {}
    };
    
    // Check MongoDB connection
    try {
      const dbStatus = mongoose.connection.readyState;
      health.services.mongodb = {
        status: dbStatus === 1 ? 'healthy' : 'unhealthy',
        connection_state: dbStatus
      };
    } catch (err) {
      health.services.mongodb = {
        status: 'unhealthy',
        error: err.message
      };
      health.status = 'degraded';
    }
    
    // Check ID generator
    try {
      const counterStatus = await getIdCounterStatus();
      health.services.id_generator = {
        status: 'healthy',
        counters: Object.keys(counterStatus).length
      };
    } catch (err) {
      health.services.id_generator = {
        status: 'unhealthy',
        error: err.message
      };
      health.status = 'degraded';
    }
    
    // Overall health status
    const hasUnhealthyService = Object.values(health.services).some(service => service.status === 'unhealthy');
    if (hasUnhealthyService) {
      health.status = 'unhealthy';
    }
    
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date()
    });
  }
};

export const systemController = {
  getSystemOverview,
  getHealthCheck
};