// middleware/error.middleware.js
export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  
  // MongoDB validation errors
  if (err.name === 'ValidationError') {
    const errors = {};
    
    Object.keys(err.errors).forEach(key => {
      errors[key] = err.errors[key].message;
    });
    
    return res.status(400).json({
      status: 'error',
      type: 'validation',
      message: 'Validation error',
      errors
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      status: 'error',
      type: 'auth',
      message: 'Invalid token'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      status: 'error',
      type: 'auth',
      message: 'Token expired'
    });
  }
  
  // Default error
  res.status(500).json({
    status: 'error',
    type: 'server',
    message: err.message || 'Internal server error'
  });
};

// 404 handler
export const notFoundHandler = (req, res) => {
  res.status(404).json({
    status: 'error',
    type: 'not_found',
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
};