// middleware/validation.middleware.js - NEW FILE
import { body, param, query, validationResult } from 'express-validator';

// Generic validation result handler
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }))
    });
  }
  next();
};

// Product validation
export const validateProduct = [
  body('model')
    .notEmpty()
    .withMessage('Product model is required')
    .isLength({ max: 64 })
    .withMessage('Model must be less than 64 characters'),
  
  body('descriptions')
    .isArray({ min: 1 })
    .withMessage('At least one product description is required'),
  
  body('descriptions.*.name')
    .notEmpty()
    .withMessage('Product name is required for each description'),
  
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  
  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Quantity must be a non-negative integer'),
  
  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array'),
  
  body('status')
    .optional()
    .isBoolean()
    .withMessage('Status must be boolean'),
  
  handleValidationErrors
];

// Customer validation
export const validateCustomer = [
  body('firstname')
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ max: 32 })
    .withMessage('First name must be less than 32 characters'),
  
  body('lastname')
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ max: 32 })
    .withMessage('Last name must be less than 32 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('telephone')
    .notEmpty()
    .withMessage('Telephone is required')
    .isLength({ max: 32 })
    .withMessage('Telephone must be less than 32 characters'),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  
  handleValidationErrors
];

// Address validation
export const validateAddress = [
  body('firstname')
    .notEmpty()
    .withMessage('First name is required'),
  
  body('lastname')
    .notEmpty()
    .withMessage('Last name is required'),
  
  body('address_1')
    .notEmpty()
    .withMessage('Address line 1 is required'),
  
  body('city')
    .notEmpty()
    .withMessage('City is required'),
  
  body('country_id')
    .isInt({ min: 1 })
    .withMessage('Valid country is required'),
  
  body('zone_id')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Zone ID must be a valid integer'),
  
  handleValidationErrors
];

// Cart validation
export const validateAddToCart = [
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('Valid product ID is required'),
  
  body('quantity')
    .isInt({ min: 1, max: 100 })
    .withMessage('Quantity must be between 1 and 100'),
  
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  
  body('options.*.option_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid option ID is required'),
  
  body('options.*.option_value_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Valid option value ID is required'),
  
  handleValidationErrors
];

// Order status validation
export const validateOrderStatus = [
  body('order_status_id')
    .isInt({ min: 1 })
    .withMessage('Valid order status ID is required'),
  
  body('comment')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Comment must be less than 500 characters'),
  
  body('notify_customer')
    .optional()
    .isBoolean()
    .withMessage('Notify customer must be boolean'),
  
  handleValidationErrors
];

// Search validation
export const validateSearch = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('price_min')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum price must be non-negative'),
  
  query('price_max')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum price must be non-negative'),
  
  query('category')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Category must be a valid integer'),
  
  query('sort')
    .optional()
    .isIn(['relevance', 'price_asc', 'price_desc', 'name_asc', 'name_desc', 'date_added', 'popularity'])
    .withMessage('Invalid sort option'),
  
  handleValidationErrors
];

// Review validation
export const validateReview = [
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('Valid product ID is required'),
  
  body('rating')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  
  body('text')
    .notEmpty()
    .withMessage('Review text is required')
    .isLength({ min: 10, max: 1000 })
    .withMessage('Review text must be between 10 and 1000 characters'),
  
  handleValidationErrors
];

// Coupon validation
export const validateCoupon = [
  body('name')
    .notEmpty()
    .withMessage('Coupon name is required')
    .isLength({ max: 128 })
    .withMessage('Name must be less than 128 characters'),
  
  body('code')
    .notEmpty()
    .withMessage('Coupon code is required')
    .isLength({ max: 20 })
    .withMessage('Code must be less than 20 characters')
    .matches(/^[A-Z0-9]+$/)
    .withMessage('Code must contain only uppercase letters and numbers'),
  
  body('type')
    .isIn(['P', 'F'])
    .withMessage('Type must be P (percentage) or F (fixed amount)'),
  
  body('discount')
    .isFloat({ min: 0 })
    .withMessage('Discount must be a positive number'),
  
  body('total')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum order total must be non-negative'),
  
  body('uses_total')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Total uses must be non-negative'),
  
  body('uses_customer')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Uses per customer must be non-negative'),
  
  handleValidationErrors
];

// ID parameter validation
export const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid ID is required'),
  
  handleValidationErrors
];

// MongoDB ObjectId validation
export const validateObjectId = [
  param('id')
    .isMongoId()
    .withMessage('Valid ObjectId is required'),
  
  handleValidationErrors
];

// Pagination validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// Date range validation
export const validateDateRange = [
  query('date_from')
    .optional()
    .isISO8601()
    .withMessage('Date from must be a valid ISO date'),
  
  query('date_to')
    .optional()
    .isISO8601()
    .withMessage('Date to must be a valid ISO date'),
  
  handleValidationErrors
];

export default {
  handleValidationErrors,
  validateProduct,
  validateCustomer,
  validateAddress,
  validateAddToCart,
  validateOrderStatus,
  validateSearch,
  validateReview,
  validateCoupon,
  validateId,
  validateObjectId,
  validatePagination,
  validateDateRange
};