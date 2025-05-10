// controllers/download.controller.js
import fs from 'fs/promises';
import path from 'path';
import Order from '../models/order.model.js';
import OrderProduct from '../models/orderProduct.model.js';

// Get list of downloadable products for a customer
export const getDownloadableProducts = async (req, res) => {
  try {
    const customerId = req.customer.id;
    
    // Find completed orders for this customer
    const orders = await Order.find({ 
      customer_id: customerId,
      order_status_id: { $in: [3, 5] } // Completed, Shipped statuses
    }).select('order_id');
    // controllers/download.controller.js (continued)
    if (!orders.length) {
      return res.json({ count: 0, downloadable_products: [] });
    }
    
    const orderIds = orders.map(o => o.order_id);
    
    // Find all products with downloads from these orders
    const downloadableProducts = await OrderProduct.find({
      order_id: { $in: orderIds },
      'download_links.0': { $exists: true } // Only products with downloads
    }).select('order_id product_id name model image download_links');
    
    // Format the response
    const formattedProducts = downloadableProducts.map(product => ({
      order_product_id: product.order_product_id,
      order_id: product.order_id,
      product_id: product.product_id,
      name: product.name,
      model: product.model,
      image: product.image,
      downloads: product.download_links.map(dl => ({
        download_id: dl.download_id,
        name: dl.name,
        remaining: dl.remaining
      }))
    }));
    
    res.json({
      count: formattedProducts.length,
      downloadable_products: formattedProducts
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching downloadable products', error: err.message });
  }
};

// Download a specific file
export const downloadFile = async (req, res) => {
  try {
    const customerId = req.customer.id;
    const downloadId = parseInt(req.params.downloadId);
    
    // Find orders for this customer
    const orders = await Order.find({ 
      customer_id: customerId,
      order_status_id: { $in: [3, 5] } // Completed, Shipped statuses
    }).select('order_id');
    
    if (!orders.length) {
      return res.status(403).json({ message: 'No qualifying orders found' });
    }
    
    const orderIds = orders.map(o => o.order_id);
    
    // Find the product with this download
    const orderProduct = await OrderProduct.findOne({
      order_id: { $in: orderIds },
      'download_links.download_id': downloadId
    });
    
    if (!orderProduct) {
      return res.status(404).json({ message: 'Download not found or not purchased' });
    }
    
    // Find the specific download
    const download = orderProduct.download_links.find(dl => dl.download_id === downloadId);
    
    if (!download) {
      return res.status(404).json({ message: 'Download not found' });
    }
    
    // Check if download is still available (if it has a limit)
    if (download.remaining === 0) {
      return res.status(403).json({ message: 'Download limit reached' });
    }
    
    // Get the file path
    // Note: You need to define where your download files are stored
    const downloadDir = process.env.DOWNLOAD_DIR || path.join(process.cwd(), 'downloads');
    const filePath = path.join(downloadDir, download.filename);
    
    try {
      // Check if file exists
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).json({ message: 'Download file not found' });
    }
    
    // Update remaining downloads if it's limited
    if (download.remaining > 0) {
      download.remaining -= 1;
      await orderProduct.save();
    }
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${download.mask}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Error processing download', error: err.message });
  }
};