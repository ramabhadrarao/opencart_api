// utils/auditLogService.js
import AuditLog from '../models/auditLog.model.js';
import { getClientIp } from '../middleware/activityTracker.middleware.js';
import geoLocationService from '../utils/geoLocationService.js';

/**
 * Service for creating audit log entries for admin actions
 */
class AuditLogService {
  /**
   * Create an audit log entry
   * @param {Object} req - Express request object
   * @param {string} action - Action performed (create, update, delete, etc.)
   * @param {string} entityType - Type of entity affected (product, customer, order, etc.)
   * @param {number|string} entityId - ID of the entity affected
   * @param {Object} prevState - Previous state of the entity (for updates)
   * @param {Object} newState - New state of the entity (for creates/updates)
   * @param {string} details - Additional details about the action
   * @returns {Promise<Object>} - Created audit log entry
   */
  async createLog(req, action, entityType, entityId, prevState = null, newState = null, details = '') {
    try {
      // Get user information
      let userId = null;
      let userType = null;
      let username = null;
      let email = null;
      
      if (req.admin) {
        userId = req.admin.id;
        userType = 'admin';
        username = req.admin.username;
        email = req.admin.email;
      } else if (req.customer) {
        userId = req.customer.id;
        userType = 'customer';
        username = req.customer.name;
        email = req.customer.email;
      } else {
        // Anonymous users shouldn't be creating audit logs
        return null;
      }
      
      // Get IP and location
      const ip = getClientIp(req);
      const locationData = await geoLocationService.getLocationFromIp(ip);
      
      // Create audit log entry
      const auditLog = new AuditLog({
        user_id: userId,
        user_type: userType,
        username,
        email,
        ip_address: ip,
        location: {
          country: locationData.country,
          region: locationData.region,
          city: locationData.city,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timezone: locationData.timezone
        },
        action,
        entity_type: entityType,
        entity_id: entityId,
        previous_state: prevState,
        new_state: newState,
        details,
        created_at: new Date()
      });
      
      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
      return null;
    }
  }
  
  /**
   * Create audit log for entity creation
   * @param {Object} req - Express request object
   * @param {string} entityType - Type of entity created
   * @param {Object} entity - The entity that was created
   * @param {string} details - Additional details
   * @returns {Promise<Object>} - Created audit log entry
   */
  async logCreate(req, entityType, entity, details = '') {
    // Determine the entity ID based on its type
    let entityId;
    switch (entityType) {
      case 'product':
        entityId = entity.product_id;
        break;
      case 'customer':
        entityId = entity.customer_id;
        break;
      case 'order':
        entityId = entity.order_id;
        break;
      case 'category':
        entityId = entity.category_id;
        break;
      default:
        entityId = entity._id || entity.id;
    }
    
    return this.createLog(
      req, 
      'create', 
      entityType, 
      entityId, 
      null, // no previous state for creation
      entity, 
      details
    );
  }
  
  /**
   * Create audit log for entity update
   * @param {Object} req - Express request object
   * @param {string} entityType - Type of entity updated
   * @param {Object} prevEntity - The entity before update
   * @param {Object} newEntity - The entity after update
   * @param {string} details - Additional details
   * @returns {Promise<Object>} - Created audit log entry
   */
  async logUpdate(req, entityType, prevEntity, newEntity, details = '') {
    // Determine the entity ID based on its type
    let entityId;
    switch (entityType) {
      case 'product':
        entityId = newEntity.product_id;
        break;
      case 'customer':
        entityId = newEntity.customer_id;
        break;
      case 'order':
        entityId = newEntity.order_id;
        break;
      case 'category':
        entityId = newEntity.category_id;
        break;
      default:
        entityId = newEntity._id || newEntity.id;
    }
    
    return this.createLog(
      req, 
      'update', 
      entityType, 
      entityId, 
      prevEntity, 
      newEntity, 
      details
    );
  }
  
  /**
   * Create audit log for entity deletion
   * @param {Object} req - Express request object
   * @param {string} entityType - Type of entity deleted
   * @param {Object} entity - The entity that was deleted
   * @param {string} details - Additional details
   * @returns {Promise<Object>} - Created audit log entry
   */
  async logDelete(req, entityType, entity, details = '') {
    // Determine the entity ID based on its type
    let entityId;
    switch (entityType) {
      case 'product':
        entityId = entity.product_id;
        break;
      case 'customer':
        entityId = entity.customer_id;
        break;
      case 'order':
        entityId = entity.order_id;
        break;
      case 'category':
        entityId = entity.category_id;
        break;
      default:
        entityId = entity._id || entity.id;
    }
    
    return this.createLog(
      req, 
      'delete', 
      entityType, 
      entityId, 
      entity, 
      null, // no new state for deletion
      details
    );
  }
  
  /**
   * Create audit log for any custom action
   * @param {Object} req - Express request object
   * @param {string} action - Custom action name
   * @param {string} entityType - Type of entity affected
   * @param {any} entityId - ID of the entity affected
   * @param {Object} data - Related data
   * @param {string} details - Additional details
   * @returns {Promise<Object>} - Created audit log entry
   */
  async logCustomAction(req, action, entityType, entityId, data = {}, details = '') {
    return this.createLog(
      req, 
      action, 
      entityType, 
      entityId, 
      null, 
      data, 
      details
    );
  }
}

// Export as singleton instance
export default new AuditLogService();