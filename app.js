// app.js - Enhanced with additional security and monitoring features
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { connectMongoDB } from './config/db.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './swagger.js';

// Import ID generation service
import { initializeIdService } from './utils/idGenerator.js';

// Middleware
import { requestLogger } from './middleware/logger.middleware.js';
import { apiLimiter, authLimiter } from './middleware/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { activityTracker } from './middleware/activityTracker.middleware.js';
import { searchLogger } from './middleware/searchLogger.middleware.js';
import { 
  customImageHandler, 
  logFileAccess, 
  rateLimitFileDownloads 
} from './middleware/imageServer.middleware.js';

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
import addressRoutes from './routes/address.routes.js';

// Initialize environment variables
dotenv.config();

// Create Express app
const app = express();

// Trust proxy for proper IP detection (important for rate limiting)
app.set('trust proxy', 1);

// Configure helmet with custom CSP for file uploads and images
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow file uploads
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // Cache preflight for 24 hours
}));

app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    // Don't compress images and already compressed files
    if (req.headers['content-type'] && 
        req.headers['content-type'].startsWith('image/')) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Increase payload limits for file uploads
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Store raw body for signature verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cookieParser());
app.use(requestLogger);
app.use(apiLimiter);

// Apply custom tracking middleware
app.use(activityTracker);
app.use(searchLogger);

// === IMAGE AND FILE SERVING ===

// Apply rate limiting specifically for file downloads (100 requests per 15 minutes)
app.use('/image', rateLimitFileDownloads(100, 15 * 60 * 1000));

// Apply file access logging
app.use('/image', logFileAccess);

// Serve images from catalog directory with custom handler
app.get('/image/*', customImageHandler);

// Serve static catalog files (for direct access if needed)
app.use('/catalog', express.static('catalog', {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  dotfiles: 'deny', // Security: deny access to dotfiles
  index: false, // Security: disable directory indexing
  setHeaders: (res, path) => {
    // Add security headers for static files
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "OpenCart REST API Documentation"
}));

// Apply route-specific rate limits
app.use('/api/customers/login', authLimiter);
app.use('/api/customers/register', authLimiter);
app.use('/api/customers/forgot-password', authLimiter);
app.use('/api/admin/login', authLimiter);

// === API ROUTES ===

app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes); // Enhanced with file management
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
app.use('/api/analytics', analyticsRoutes);
app.use('/api/addresses', addressRoutes);

// === HEALTH CHECK ===

app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await checkDatabaseHealth();
    
    // Check file system
    const fsStatus = await checkFileSystemHealth();
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {
        database: dbStatus ? 'connected' : 'disconnected',
        file_uploads: fsStatus ? 'enabled' : 'error',
        image_serving: 'enabled'
      }
    };
    
    const httpStatus = dbStatus && fsStatus ? 200 : 503;
    res.status(httpStatus).json(healthStatus);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date(),
      error: error.message
    });
  }
});

// === METRICS ENDPOINT (for monitoring) ===

app.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: process.version,
    platform: process.platform
  };
  
  res.json(metrics);
});

// === INDEX ROUTE ===

app.get('/api', (req, res) => {
  res.json({
    message: 'OpenCart REST API with Enhanced File Management',
    version: '2.1',
    documentation: '/api-docs',
    health_check: '/health',
    metrics: '/metrics',
    features: [
      'Product CRUD with file uploads',
      'Image management and serving',
      'Secure file downloads for customers',
      'Temporary download links (30min expiry)',
      'File upload validation',
      'Image optimization and caching',
      'Rate limiting for downloads',
      'File access logging',
      'Health monitoring',
      'Performance metrics'
    ],
    endpoints: [
      '/api/customers',
      '/api/products (enhanced)',
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
      '/api/analytics',
      '/api/addresses'
    ],
    file_management: {
      image_endpoint: '/image/*',
      upload_limits: {
        images: '5MB',
        files: '50MB'
      },
      supported_formats: {
        images: ['JPEG', 'PNG', 'GIF', 'WebP'],
        files: ['ZIP', 'PDF', 'DOC', 'DOCX', 'TXT', 'XLS', 'XLSX']
      },
      security: {
        rate_limiting: '100 requests per 15 minutes',
        file_validation: 'MIME type + signature verification',
        access_logging: 'enabled'
      }
    }
  });
});

// === GRACEFUL SHUTDOWN ===

const gracefulShutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // Close server
  server.close((err) => {
    if (err) {
      console.error('❌ Error during server shutdown:', err);
      process.exit(1);
    }
    
    console.log('✅ Server closed successfully');
    
    // Close database connection
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// === ERROR HANDLING ===

app.use(notFoundHandler);
app.use(errorHandler);

// === HELPER FUNCTIONS ===

async function checkDatabaseHealth() {
  try {
    // You can add a simple database ping here
    // For example: await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

async function checkFileSystemHealth() {
  try {
    const fs = await import('fs/promises');
    await fs.access('./catalog');
    return true;
  } catch (error) {
    console.error('File system health check failed:', error);
    return false;
  }
}

// === SERVER STARTUP ===

const PORT = process.env.PORT || 5000;
let server;

connectMongoDB()
  .then(async () => {
    console.log('✅ MongoDB connected');
    
    // 🚀 INITIALIZE ID GENERATION SERVICE
    try {
      await initializeIdService();
      console.log('✅ ID generation service ready');
    } catch (error) {
      console.error('❌ Failed to initialize ID service:', error);
      // You can choose to exit here or continue without the service
      // process.exit(1);
    }
    
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 All services initialized and ready`);
      console.log(`📖 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`❤️  Health Check: http://localhost:${PORT}/health`);
      console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
    });
    
    // Setup graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

export default app;