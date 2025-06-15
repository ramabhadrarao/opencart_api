// middleware/imageServer.middleware.js - Enhanced version with additional features
import express from 'express';
import path from 'path';
import fs from 'fs/promises';

/**
 * Middleware to serve images from catalog directory
 * Maps /image/* requests to catalog/ directory
 */
export const imageServerMiddleware = express.static(
  path.join(process.cwd(), 'catalog'),
  {
    // Options for serving static files
    maxAge: '1d', // Cache for 1 day
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Set appropriate content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      
      if (['.jpg', '.jpeg'].includes(ext)) {
        res.setHeader('Content-Type', 'image/jpeg');
      } else if (ext === '.png') {
        res.setHeader('Content-Type', 'image/png');
      } else if (ext === '.gif') {
        res.setHeader('Content-Type', 'image/gif');
      } else if (ext === '.webp') {
        res.setHeader('Content-Type', 'image/webp');
      } else if (ext === '.svg') {
        res.setHeader('Content-Type', 'image/svg+xml');
      }
      
      // Add cache control headers
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
    }
  }
);

/**
 * Custom image handler with better error handling and validation
 */
export const customImageHandler = async (req, res, next) => {
  try {
    const imagePath = req.params[0]; // Capture the full path after /image/
    
    if (!imagePath) {
      return res.status(400).json({ message: 'Image path is required' });
    }
    
    // Security: Prevent directory traversal
    if (imagePath.includes('..') || imagePath.includes('~')) {
      return res.status(403).json({ message: 'Invalid image path' });
    }
    
    // Construct full file path
    const fullPath = path.join(process.cwd(), 'catalog', imagePath);
    
    // Check if file exists
    try {
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Check file extension
      const ext = path.extname(fullPath).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      
      if (!allowedExtensions.includes(ext)) {
        return res.status(400).json({ message: 'Invalid image format' });
      }
      
      // Set appropriate headers
      let contentType = 'image/jpeg';
      switch (ext) {
        case '.png':
          contentType = 'image/png';
          break;
        case '.gif':
          contentType = 'image/gif';
          break;
        case '.webp':
          contentType = 'image/webp';
          break;
        case '.svg':
          contentType = 'image/svg+xml';
          break;
      }
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      
      // Add ETag for better caching
      const etag = `"${stats.mtime.getTime()}-${stats.size}"`;
      res.setHeader('ETag', etag);
      
      // Check if client has cached version
      if (req.headers['if-none-match'] === etag) {
        return res.status(304).end();
      }
      
      // Stream the file
      const fileStream = require('fs').createReadStream(fullPath);
      fileStream.pipe(res);
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        return res.status(404).json({ message: 'Image not found' });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ message: 'Error serving image' });
  }
};

/**
 * Image upload validation middleware
 */
export const validateImageUpload = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No image file provided' });
  }
  
  // Check file size (5MB limit)
  if (req.file.size > 5 * 1024 * 1024) {
    return res.status(400).json({ message: 'Image file too large (max 5MB)' });
  }
  
  // Check MIME type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ 
      message: 'Invalid image type. Allowed: JPEG, PNG, GIF, WebP' 
    });
  }
  
  // Additional security check: validate file signature
  if (!validateFileSignature(req.file.buffer, req.file.mimetype)) {
    return res.status(400).json({ 
      message: 'Invalid file signature. File may be corrupted or not a valid image.' 
    });
  }
  
  next();
};

/**
 * File upload validation middleware for product files
 */
export const validateFileUpload = (req, res, next) => {
  if (!req.file) {
    // File upload is optional for option values
    return next();
  }
  
  // Check file size (50MB limit for product files)
  if (req.file.size > 50 * 1024 * 1024) {
    return res.status(400).json({ message: 'File too large (max 50MB)' });
  }
  
  // Check MIME type
  const allowedTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({ 
      message: 'Invalid file type. Allowed: ZIP, PDF, images, documents, spreadsheets' 
    });
  }
  
  next();
};

/**
 * Validate file signature to prevent malicious uploads
 */
const validateFileSignature = (buffer, mimeType) => {
  if (!buffer || buffer.length < 4) return false;
  
  const signatures = {
    'image/jpeg': [0xFF, 0xD8, 0xFF],
    'image/png': [0x89, 0x50, 0x4E, 0x47],
    'image/gif': [0x47, 0x49, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46] // First 4 bytes of WEBP
  };
  
  const signature = signatures[mimeType];
  if (!signature) return true; // Unknown type, let it pass
  
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  
  return true;
};

/**
 * Image resizing middleware (optional - requires sharp package)
 * Uncomment and install sharp if you want image resizing functionality
 */
/*
import sharp from 'sharp';

export const resizeImage = (width, height, quality = 80) => {
  return async (req, res, next) => {
    if (!req.file) return next();
    
    try {
      const resizedBuffer = await sharp(req.file.buffer)
        .resize(width, height, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality })
        .toBuffer();
      
      req.file.buffer = resizedBuffer;
      req.file.size = resizedBuffer.length;
      
      next();
    } catch (error) {
      res.status(400).json({ message: 'Error processing image', error: error.message });
    }
  };
};
*/

/**
 * Clean up orphaned files middleware
 */
export const cleanupOrphanedFiles = async () => {
  try {
    const catalogDir = path.join(process.cwd(), 'catalog');
    const productDir = path.join(catalogDir, 'product');
    const filesDir = path.join(catalogDir, 'files');
    
    // This would need to be implemented based on your Product model
    // to check which files are actually referenced in the database
    console.log('Cleanup process would run here');
    
    // Example implementation:
    // 1. Get all file paths from database
    // 2. Get all files in catalog directories
    // 3. Delete files not referenced in database
    
  } catch (error) {
    console.error('Error during file cleanup:', error);
  }
};

/**
 * File access logging middleware
 */
export const logFileAccess = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log successful file access
    if (res.statusCode === 200) {
      console.log(`File accessed: ${req.originalUrl} - IP: ${req.ip} - Time: ${new Date().toISOString()}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Rate limiting for file downloads
 */
export const rateLimitFileDownloads = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    // Clean old entries
    for (const [id, data] of requests.entries()) {
      if (now - data.firstRequest > windowMs) {
        requests.delete(id);
      }
    }
    
    // Check current client
    const clientData = requests.get(clientId);
    
    if (!clientData) {
      requests.set(clientId, { firstRequest: now, count: 1 });
      return next();
    }
    
    if (now - clientData.firstRequest > windowMs) {
      // Reset window
      requests.set(clientId, { firstRequest: now, count: 1 });
      return next();
    }
    
    clientData.count++;
    
    if (clientData.count > maxRequests) {
      return res.status(429).json({ 
        message: 'Too many file requests. Please try again later.' 
      });
    }
    
    next();
  };
};

export default {
  imageServerMiddleware,
  customImageHandler,
  validateImageUpload,
  validateFileUpload,
  logFileAccess,
  rateLimitFileDownloads,
  cleanupOrphanedFiles
};