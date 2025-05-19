// utils/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Get current directory for resolving template paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Nodemailer transporter with configuration from .env
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

/**
 * Load an email template and replace placeholders with values
 * @param {string} templateName - Name of the template file without extension
 * @param {Object} replacements - Key-value pairs for replacements
 * @returns {Promise<string>} Processed HTML content
 */
const loadTemplate = async (templateName, replacements = {}) => {
  try {
    // Define templates directory - create if it doesn't exist
    const templatesDir = path.join(__dirname, '..', 'templates', 'emails');
    
    try {
      await fs.mkdir(templatesDir, { recursive: true });
    } catch (err) {
      console.log('Templates directory already exists or error creating it:', err.message);
    }
    
    // Check if template exists, otherwise use default
    const templatePath = path.join(templatesDir, `${templateName}.html`);
    let template;
    
    try {
      template = await fs.readFile(templatePath, 'utf8');
    } catch (err) {
      // If specific template doesn't exist, use generic template
      template = await getDefaultTemplate();
    }
    
    // Replace placeholders with values
    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{\s*${key}\s*}}`, 'g');
      template = template.replace(regex, value);
    }
    
    return template;
  } catch (err) {
    console.error('Error loading email template:', err.message);
    return getDefaultTemplate(replacements);
  }
};

/**
 * Generate a simple default template if no template file is found
 * @param {Object} replacements - Key-value pairs for replacements
 * @returns {Promise<string>} Default HTML template
 */
const getDefaultTemplate = async (replacements = {}) => {
  const defaultTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{{ subject }}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 15px; text-align: center; }
        .content { padding: 20px; }
        .footer { text-align: center; font-size: 12px; color: #777; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>{{ company_name }}</h2>
        </div>
        <div class="content">
          <h3>{{ subject }}</h3>
          <p>{{ message }}</p>
          <p>{{ action_text }} <a href="{{ action_url }}">{{ action_label }}</a></p>
        </div>
        <div class="footer">
          <p>© {{ current_year }} {{ company_name }}. All rights reserved.</p>
          <p>If you didn't request this email, please ignore it.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  // Replace placeholders with values
  let html = defaultTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(`{{\s*${key}\s*}}`, 'g');
    html = html.replace(regex, value || '');
  }
  
  // Set default values for any unreplaced placeholders
  html = html.replace(/{{.+?}}/g, '');
  
  return html;
};

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.template - Template name (without extension)
 * @param {Object} options.data - Data for template replacements
 * @param {Array} [options.attachments] - Email attachments
 * @returns {Promise} Nodemailer send result
 */
export const sendEmail = async (options) => {
  try {
    // Verify transporter connection
    await transporter.verify();
    
    // Prepare template data with some default values
    const templateData = {
      company_name: process.env.EMAIL_FROM_NAME || 'OpenCart Store',
      current_year: new Date().getFullYear(),
      ...options.data
    };
    
    // Load and process template
    const html = await loadTemplate(options.template, templateData);
    
    // Prepare email options
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`,
      to: options.to,
      subject: options.subject,
      html: html,
      attachments: options.attachments || []
    };
    
    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error('❌ Error sending email:', err.message);
    throw new Error(`Failed to send email: ${err.message}`);
  }
};

// Email templates for specific use cases

/**
 * Send password reset email
 * @param {string} email - Recipient email
 * @param {string} token - Reset token
 * @param {string} resetUrl - URL for reset page
 * @returns {Promise} Email send result
 */
export const sendPasswordResetEmail = async (email, token, resetUrl) => {
  const resetLink = `${resetUrl}?token=${token}&email=${encodeURIComponent(email)}`;
  
  return sendEmail({
    to: email,
    subject: 'Password Reset Request',
    template: 'password-reset',
    data: {
      subject: 'Password Reset Request',
      message: 'You have requested to reset your password. Click the button below to reset it. This link will expire in 15 minutes.',
      action_text: 'To reset your password, please click on this link:',
      action_url: resetLink,
      action_label: 'Reset Password',
      token: token
    }
  });
};

/**
 * Send order confirmation email
 * @param {Object} order - Order details
 * @param {Object} customer - Customer details
 * @returns {Promise} Email send result
 */
export const sendOrderConfirmationEmail = async (order, customer) => {
  // Format order items for display
  const orderItems = order.items.map(item => `
    <tr>
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>$${parseFloat(item.price).toFixed(2)}</td>
      <td>$${parseFloat(item.subtotal).toFixed(2)}</td>
    </tr>
  `).join('');
  
  return sendEmail({
    to: customer.email,
    subject: `Order Confirmation #${order.order_id}`,
    template: 'order-confirmation',
    data: {
      subject: `Order Confirmation #${order.order_id}`,
      customer_name: `${customer.firstname} ${customer.lastname}`,
      order_id: order.order_id,
      order_date: new Date(order.date_added).toLocaleDateString(),
      order_items: orderItems,
      order_total: `$${parseFloat(order.total).toFixed(2)}`,
      shipping_method: order.shipping_method,
      payment_method: order.payment_method
    }
  });
};

/**
 * Send welcome email to new customers
 * @param {Object} customer - Customer details
 * @returns {Promise} Email send result
 */
export const sendWelcomeEmail = async (customer) => {
  return sendEmail({
    to: customer.email,
    subject: 'Welcome to Our Store',
    template: 'welcome',
    data: {
      subject: 'Welcome to Our Store',
      customer_name: `${customer.firstname} ${customer.lastname}`,
      message: 'Thank you for creating an account with us. We\'re excited to have you as a customer!'
    }
  });
};

// Verify connection on startup
transporter.verify()
  .then(() => console.log('✅ Email service ready'))
  .catch(err => console.error('❌ Email service error:', err.message));

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
  sendWelcomeEmail
};