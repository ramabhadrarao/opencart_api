// middleware/logger.middleware.js
export const requestLogger = (req, res, next) => {
  const start = new Date();
  
  res.on('finish', () => {
    const duration = new Date() - start;
    
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  
  next();
};