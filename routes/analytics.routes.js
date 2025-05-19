// routes/analytics.routes.js
import express from 'express';
import {
  getOnlineUsers,
  getUserActivity,
  getSearchAnalytics,
  getAuditLogs,
  getUserLocations,
  getSystemOverview
} from '../controllers/analytics.controller.js';
import { authenticateAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All analytics routes require admin authentication
router.use(authenticateAdmin);

// System overview
router.get('/overview', getSystemOverview);

// Online users analytics
router.get('/online-users', getOnlineUsers);

// User activity analytics
router.get('/user-activity', getUserActivity);

// Search analytics
router.get('/searches', getSearchAnalytics);

// Audit logs
router.get('/audit-logs', getAuditLogs);

// User locations analytics
router.get('/user-locations', getUserLocations);

export default router;