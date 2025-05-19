# User Activity Tracking and Audit Logging Implementation Guide

This guide explains how to implement and use the comprehensive user activity tracking and audit logging system for your OpenCart API.

## Overview

This system tracks:

1. **Online Users**: Who is currently browsing the store (logged in and guests)
2. **User Activity**: All user actions (logins, product views, searches, etc.)
3. **Search Analytics**: What users are searching for and search result metrics
4. **Audit Logs**: System changes made by administrators
5. **Geolocation Data**: Where users are accessing from

## Installation

1. **Add new models**:
   - Copy all files from the "User Activity Models" artifact to your `models/` directory

2. **Add utility services**:
   - Copy the "Geolocation Service" artifact to `utils/geoLocationService.js`
   - Copy the "Audit Log Service" artifact to `utils/auditLogService.js`

3. **Add middleware**:
   - Copy "Activity Tracker Middleware" artifact to `middleware/activityTracker.middleware.js`
   - Copy "Search Logger and Enhanced Controller" to `middleware/searchLogger.middleware.js` and update your `controllers/search.controller.js`

4. **Add analytics controllers**:
   - Copy "Analytics Controller" artifact to `controllers/analytics.controller.js`
   - Copy "Analytics Routes" artifact to `routes/analytics.routes.js`

5. **Update app.js**:
   - Update your app.js to include the new routes and middleware as shown in the "Updated app.js" artifact

6. **Update package.json**:
   - Add the new dependencies from the "Updated package.json" artifact
   - Run `npm install` to install the new dependencies

## Configuration

1. **Environment Variables**:
   Add the following to your `.env` file:

   ```
   # Optional geolocation API keys for higher rate limits
   IPINFO_TOKEN=your_ipinfo_token_here
   IPGEOLOCATION_API_KEY=your_ipgeolocation_api_key_here
   ```

2. **Database Indexes**:
   The MongoDB models are set up with indexes including TTL (Time To Live) indexes that automatically remove old records. Key TTL settings:
   
   - Online users: 15 minutes (inactive users removed)
   - User activities: 30 days (older activities removed)
   - Search logs: 90 days (older logs removed)
   
   You can adjust these TTL values in the model files if needed.

## Usage

### Activity Tracking

The system will automatically track:

1. **Page Views**: Every page a user views
2. **User Login/Logout**: When users log in or out
3. **Search Queries**: What users search for, including filters used
4. **Product Views**: Which products users are viewing
5. **Cart Actions**: When products are added to cart
6. **Checkout Process**: Steps in the checkout process
7. **Registration**: When new users register

This tracking happens automatically through the middleware.

### Audit Logging

For admin actions that modify data, use the `auditLogService` in your controllers. Examples:

```javascript
import auditLogService from '../utils/auditLogService.js';

// When creating a product
export const createProduct = async (req, res) => {
  try {
    // Your existing product creation code...
    const product = new Product({ ... });
    await product.save();
    
    // Log the action
    await auditLogService.logCreate(req, 'product', product);
    
    res.status(201).json({ ... });
  } catch (err) {
    res.status(500).json({ message: 'Error creating product', error: err.message });
  }
};

// When updating a product
export const updateProduct = async (req, res) => {
  try {
    // Get the product before update for comparison
    const originalProduct = await Product.findOne({ product_id: req.params.id });
    
    // Your existing update code...
    const updatedProduct = await Product.findOneAndUpdate(...);
    
    // Log the action
    await auditLogService.logUpdate(req, 'product', originalProduct, updatedProduct);
    
    res.json({ ... });
  } catch (err) {
    res.status(500).json({ message: 'Error updating product', error: err.message });
  }
};

// When deleting a product
export const deleteProduct = async (req, res) => {
  try {
    // Get the product before deletion
    const product = await Product.findOne({ product_id: req.params.id });
    
    // Your existing deletion code...
    await Product.deleteOne({ product_id: req.params.id });
    
    // Log the action
    await auditLogService.logDelete(req, 'product', product);
    
    res.json({ ... });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting product', error: err.message });
  }
};
```

### Accessing Analytics

The system provides several admin-only API endpoints:

1. **System Overview**: `/api/analytics/overview`
   - Active users, total products, customers, orders, etc.

2. **Online Users**: `/api/analytics/online-users`
   - Currently active users with location and device info

3. **User Activity**: `/api/analytics/user-activity`
   - Detailed logs of user actions

4. **Search Analytics**: `/api/analytics/searches`
   - Popular searches, zero-result searches, and search trends

5. **User Locations**: `/api/analytics/user-locations`
   - Geographic distribution of users

6. **Audit Logs**: `/api/analytics/audit-logs`
   - Admin action logs with before/after state

All analytics endpoints support filtering by various parameters.

## Performance Considerations

1. **Indexing**: All models use MongoDB indexes to ensure fast queries

2. **Caching**: The geolocation service caches IP lookups for 24 hours to reduce API calls

3. **TTL Indexes**: Automatic cleanup of old data to prevent database bloat

4. **Asynchronous Tracking**: Activity logging happens after the main response is sent for minimal impact on API performance

5. **Error Handling**: All tracking code has error handling to ensure it never breaks the main application flow

## Security Considerations

1. The system stores IP addresses and geolocation data. Ensure your privacy policy covers this data collection.

2. All analytics endpoints require admin authentication.

3. Sensitive fields (e.g., passwords) are automatically excluded from audit logs.

4. Consider implementing IP anonymization for GDPR compliance if needed.

## Extending the System

To track additional activities:

1. Add new activity types to the `activity_type` enum in the UserActivity model

2. Update the activityTracker middleware to detect and log the new activity type

3. Add new analytics queries to the analytics controller as needed

## Troubleshooting

1. **Missing data**: Check the MongoDB collections to ensure data is being saved

2. **Geolocation errors**: The system uses multiple fallback APIs; check the console for errors

3. **Performance issues**: Monitor the MongoDB CPU and memory usage; consider adjusting TTL indexes

4. **IP detection issues**: If behind a proxy, ensure the `getClientIp` function correctly extracts the real client IP
