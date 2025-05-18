// controllers/upload.controller.js
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Path to uploaded files
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// Get a product option uploaded file
export const getUploadedFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ message: 'File name is required' });
    }
    
    // Sanitize filename to prevent path traversal
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, sanitizedFilename);
    
    try {
      // Check if file exists
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Get file info
    const stats = await fs.stat(filePath);
    
    // Get MIME type based on extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream'; // Default
    
    // Set content type based on extension
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.txt') contentType = 'text/plain';
    else if (ext === '.doc' || ext === '.docx') contentType = 'application/msword';
    else if (ext === '.xls' || ext === '.xlsx') contentType = 'application/vnd.ms-excel';
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving file', error: err.message });
  }
};

// Get a list of uploads for a product
export const getProductUploads = async (req, res) => {
  try {
    const { product_id } = req.params;
    
    if (!product_id) {
      return res.status(400).json({ message: 'Product ID is required' });
    }
    
    // List files in upload directory
    const files = await fs.readdir(UPLOAD_DIR);
    
    // Filter files for this product
    const productFiles = files.filter(file => 
      file.startsWith(`${product_id}_`)
    );
    
    const fileDetails = await Promise.all(productFiles.map(async (file) => {
      const stats = await fs.stat(path.join(UPLOAD_DIR, file));
      
      // Extract option_value_id from filename pattern: product_id_option_value_id_originalname
      const parts = file.split('_');
      const option_value_id = parts.length > 1 ? parts[1] : 'unknown';
      
      return {
        filename: file,
        size: stats.size,
        option_value_id,
        date_added: stats.mtime
      };
    }));
    
    res.json({
      product_id,
      files: fileDetails
    });
  } catch (err) {
    res.status(500).json({ message: 'Error listing product uploads', error: err.message });
  }
};