// app.js with updated routes and middleware
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { connectMongoDB } from './config/db.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';

// Middleware
import { requestLogger } from './middleware/logger.middleware.js';
import { apiLimiter, authLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { activityTracker } from './middleware/activityTracker.middleware.js';
import { searchLogger } from './middleware/searchLogger.middleware.js';

// Routes
import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import categoryRoutes from './routes/category.routes.js';
import manufacturerRoutes from './routes/manufacturer.routes.js';
import orderRoutes from './routes/order.routes.js';
import cartRoutes from './routes/cart.routes.js';
import wishlistRoutes from './routes/wishlist.routes.js';
import downloadRoutes from './routes/download.routes.js';
import reviewRoutes from './routes/review.routes.js';
import searchRoutes from './routes/search.routes.js';
import locationRoutes from './routes/location.routes.js';
import checkoutRoutes from './routes/checkout.routes.js';
import docsRoutes from './routes/docs.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import adminRoutes from './routes/admin.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import couponRoutes from './routes/coupon.routes.js';
import backupRoutes from './routes/backup.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// Apply global middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Added for session cookies
app.use(requestLogger);
app.use(apiLimiter);

// Apply custom tracking middleware
app.use(activityTracker);
app.use(searchLogger);

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Apply route-specific rate limits
app.use('/api/customers/login', authLimiter);
app.use('/api/customers/register', authLimiter);
app.use('/api/customers/forgot-password', authLimiter);
app.use('/api/admin/login', authLimiter);

// API routes
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/manufacturers', manufacturerRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/downloads', downloadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/analytics', analyticsRoutes); // New analytics routes

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date() });
});

// Index route
app.get('/api', (req, res) => {
  res.json({
    message: 'OpenCart REST API',
    version: '1.0',
    documentation: '/api-docs',
    endpoints: [
      '/api/customers',
      '/api/products',
      '/api/categories',
      '/api/manufacturers',
      '/api/orders',
      '/api/cart',
      '/api/wishlist',
      '/api/downloads',
      '/api/reviews',
      '/api/search',
      '/api/locations',
      '/api/checkout',
      '/api/docs',
      '/api/admin',
      '/api/dashboard',
      '/api/coupons',
      '/api/backup',
      '/api/analytics' // New analytics endpoint
    ]
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

connectMongoDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

export default app;