// middleware/rate-limit.middleware.js
import rateLimit from 'express-rate-limit';

// Basic rate limiter for all routes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    type: 'rate_limit',
    message: 'Too many requests, please try again later'
  }
});

// Stricter limit for auth routes
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    type: 'rate_limit',
    message: 'Too many authentication attempts, please try again later'
  }
});