# OpenCart API - Complete Routes with cURL for Postman

## 🔐 **AUTHENTICATION ROUTES**

### 1. Admin Login
**Purpose**: Authenticate admin user and get JWT token  
**Route**: `POST /api/admin/login`  
**Auth**: Public  

```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

### 2. Customer Login
**Purpose**: Authenticate customer and get JWT token  
**Route**: `POST /api/customers/login`  
**Auth**: Public  

```bash
curl -X POST http://localhost:5000/api/customers/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "naseerahamed.sk@gmail.com",
    "password": "naseer03"
  }'
```

### 3. Customer Registration
**Purpose**: Register new customer account  
**Route**: `POST /api/customers/register`  
**Auth**: Public  

```bash
curl -X POST http://localhost:5000/api/customers/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "email": "john.doe@example.com",
    "telephone": "+1234567890",
    "password": "password123",
    "newsletter": true,
    "agree": true
  }'
```

### 4. Forgot Password
**Purpose**: Request password reset email  
**Route**: `POST /api/customers/forgot-password`  
**Auth**: Public  

```bash
curl -X POST http://localhost:5000/api/customers/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com"
  }'
```

### 5. Reset Password
**Purpose**: Reset password using token from email  
**Route**: `POST /api/customers/reset-password`  
**Auth**: Public  

```bash
curl -X POST http://localhost:5000/api/customers/reset-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "token": "reset-token-from-email",
    "new_password": "newpassword123"
  }'
```

---

## 👥 **CUSTOMER MANAGEMENT ROUTES**

### 6. Get Customer Profile
**Purpose**: Get authenticated customer's profile data  
**Route**: `GET /api/customers/profile`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/customers/profile \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 7. Update Customer Profile
**Purpose**: Update customer profile information  
**Route**: `PUT /api/customers/profile`  
**Auth**: Customer Required  

```bash
curl -X PUT http://localhost:5000/api/customers/profile \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "John Updated",
    "lastname": "Doe Updated",
    "telephone": "+1234567891",
    "newsletter": false
  }'
```

### 8. Change Customer Password
**Purpose**: Change customer password (requires current password)  
**Route**: `POST /api/customers/change-password`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/customers/change-password \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "oldpassword",
    "new_password": "newpassword123"
  }'
```

### 9. Get All Customers (Admin)
**Purpose**: Get paginated list of all customers with filters  
**Route**: `GET /api/customers`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/customers?page=1&limit=20&search=john&status=true&group=1&date_from=2024-01-01" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 10. Get Customer by ID (Admin)
**Purpose**: Get specific customer details by ID  
**Route**: `GET /api/customers/:id`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/customers/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 11. Create Customer (Admin)
**Purpose**: Admin creates new customer account  
**Route**: `POST /api/customers`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Jane",
    "lastname": "Smith",
    "email": "jane.smith@example.com",
    "telephone": "+1987654321",
    "password": "password123",
    "customer_group_id": 1,
    "status": true,
    "newsletter": false
  }'
```

### 12. Update Customer (Admin)
**Purpose**: Admin updates customer information  
**Route**: `PUT /api/customers/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/customers/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Jane Updated",
    "lastname": "Smith Updated",
    "status": false,
    "customer_group_id": 2
  }'
```

### 13. Delete Customer (Admin)
**Purpose**: Admin deletes customer account  
**Route**: `DELETE /api/customers/:id`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/customers/123 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🏠 **ADDRESS MANAGEMENT ROUTES**

### 14. Get Customer Addresses
**Purpose**: Get all addresses for authenticated customer  
**Route**: `GET /api/customers/addresses`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/customers/addresses \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 15. Add Customer Address
**Purpose**: Add new address to customer account  
**Route**: `POST /api/customers/address`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/customers/address \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "John",
    "lastname": "Doe",
    "company": "Tech Corp",
    "address_1": "123 Main Street",
    "address_2": "Apt 4B",
    "city": "New York",
    "postcode": "10001",
    "country_id": 223,
    "zone_id": 36
  }'
```

### 16. Update Customer Address
**Purpose**: Update existing customer address  
**Route**: `PUT /api/customers/address/:addressId`  
**Auth**: Customer Required  

```bash
curl -X PUT http://localhost:5000/api/customers/address/1 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "address_1": "456 Updated Street",
    "city": "Updated City",
    "postcode": "10002"
  }'
```

### 17. Delete Customer Address
**Purpose**: Remove address from customer account  
**Route**: `DELETE /api/customers/address/:addressId`  
**Auth**: Customer Required  

```bash
curl -X DELETE http://localhost:5000/api/customers/address/1 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 18. Set Default Address
**Purpose**: Set specific address as customer's default  
**Route**: `POST /api/customers/address/:addressId/default`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/customers/address/1/default \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

---

## 📦 **PRODUCT MANAGEMENT ROUTES**

### 19. Get All Products
**Purpose**: Get paginated products with advanced filtering  
**Route**: `GET /api/products`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/products?page=1&limit=12&category=20&manufacturer=8&search=laptop&sort=price_asc&price_min=100&price_max=2000&status=true" \
  -H "Content-Type: application/json"
```

### 20. Get Product by ID
**Purpose**: Get detailed information for specific product  
**Route**: `GET /api/products/:id`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/products/42 \
  -H "Content-Type: application/json"
```

### 21. Create Product (Admin)
**Purpose**: Create new product with full details  
**Route**: `POST /api/products`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "LAPTOP-2024-001",
    "sku": "LP2024001",
    "price": 999.99,
    "quantity": 50,
    "status": true,
    "manufacturer_id": 8,
    "categories": [20, 18],
    "weight": 2.5,
    "dimensions": {
      "length": 35,
      "width": 25,
      "height": 3
    },
    "descriptions": [
      {
        "language_id": 1,
        "name": "Gaming Laptop 2024",
        "description": "High-performance gaming laptop with RTX graphics",
        "meta_title": "Gaming Laptop",
        "meta_description": "Best gaming laptop for 2024",
        "meta_keyword": "gaming, laptop, rtx, performance"
      }
    ]
  }'
```

### 22. Update Product (Admin)
**Purpose**: Update existing product information  
**Route**: `PUT /api/products/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/products/42 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 899.99,
    "quantity": 75,
    "status": true,
    "sort_order": 1
  }'
```

### 23. Delete Product (Admin)
**Purpose**: Remove product from catalog  
**Route**: `DELETE /api/products/:id`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/products/42 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 24. Update Product Description (Admin)
**Purpose**: Update product description for specific language  
**Route**: `PUT /api/products/:id/descriptions/:languageId`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/products/42/descriptions/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Gaming Laptop 2024",
    "description": "Updated description with new features",
    "meta_title": "Updated Gaming Laptop",
    "meta_description": "Updated meta description"
  }'
```

### 25. Add Product Attribute (Admin)
**Purpose**: Add attribute to product (color, size, etc.)  
**Route**: `POST /api/products/:id/attributes`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/products/42/attributes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "attribute_id": 1,
    "name": "Color",
    "text": "Black"
  }'
```

### 26. Add Product Option (Admin)
**Purpose**: Add selectable option to product (size, color variants)  
**Route**: `POST /api/products/:id/options`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/products/42/options \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "option_id": 5,
    "name": "Memory",
    "type": "select",
    "required": true,
    "values": [
      {
        "option_value_id": 41,
        "name": "8GB",
        "price": 0,
        "price_prefix": "+",
        "quantity": 10
      },
      {
        "option_value_id": 42,
        "name": "16GB",
        "price": 200,
        "price_prefix": "+",
        "quantity": 15
      }
    ]
  }'
```

### 27. Add Product Image (Admin)
**Purpose**: Add additional image to product gallery  
**Route**: `POST /api/products/:id/images`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/products/42/images \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "catalog/products/laptop-side-view.jpg",
    "sort_order": 1
  }'
```

### 28. Add Related Product (Admin)
**Purpose**: Link related/recommended products  
**Route**: `POST /api/products/:id/related`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/products/42/related \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "related_id": 43
  }'
```

---

## 📂 **CATEGORY MANAGEMENT ROUTES**

### 29. Get All Categories
**Purpose**: Get flat list of all categories  
**Route**: `GET /api/categories`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/categories?include_inactive=false" \
  -H "Content-Type: application/json"
```

### 30. Get Category Tree
**Purpose**: Get hierarchical category structure  
**Route**: `GET /api/categories/tree`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/categories/tree?max_depth=3&include_counts=true" \
  -H "Content-Type: application/json"
```

### 31. Get Top Categories
**Purpose**: Get root-level categories for main navigation  
**Route**: `GET /api/categories/top`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/categories/top?limit=8" \
  -H "Content-Type: application/json"
```

### 32. Search Categories
**Purpose**: Search categories by name  
**Route**: `GET /api/categories/search`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/categories/search?q=laptop&limit=10" \
  -H "Content-Type: application/json"
```

### 33. Get Category by ID
**Purpose**: Get category details with products  
**Route**: `GET /api/categories/:id`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/categories/20?page=1&limit=12&sort=price_asc&order=asc" \
  -H "Content-Type: application/json"
```

### 34. Get Category Path
**Purpose**: Get breadcrumb navigation for category  
**Route**: `GET /api/categories/:id/path`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/categories/20/path \
  -H "Content-Type: application/json"
```

### 35. Create Category (Admin)
**Purpose**: Create new product category  
**Route**: `POST /api/categories`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/categories \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parent_id": 0,
    "image": "catalog/categories/laptops.jpg",
    "top": true,
    "column": 1,
    "sort_order": 1,
    "status": true,
    "descriptions": [
      {
        "language_id": 1,
        "name": "Gaming Laptops",
        "description": "High-performance gaming laptops",
        "meta_title": "Gaming Laptops",
        "meta_description": "Shop the best gaming laptops"
      }
    ]
  }'
```

### 36. Update Category (Admin)
**Purpose**: Update existing category information  
**Route**: `PUT /api/categories/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/categories/20 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sort_order": 2,
    "status": false,
    "descriptions": [
      {
        "language_id": 1,
        "name": "Updated Category Name",
        "description": "Updated category description"
      }
    ]
  }'
```

### 37. Delete Category (Admin)
**Purpose**: Remove category from system  
**Route**: `DELETE /api/categories/:id`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/categories/20 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🛒 **SHOPPING CART ROUTES**

### 38. Get Cart
**Purpose**: Get customer's current cart with totals  
**Route**: `GET /api/cart`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/cart \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 39. Get Cart Summary
**Purpose**: Get lightweight cart summary (count, total)  
**Route**: `GET /api/cart/summary`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/cart/summary \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 40. Add to Cart
**Purpose**: Add product with options to cart  
**Route**: `POST /api/cart/add`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/cart/add \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 42,
    "quantity": 2,
    "options": [
      {
        "option_id": 5,
        "option_value_id": 42
      }
    ]
  }'
```

### 41. Update Cart Item
**Purpose**: Change quantity of item in cart  
**Route**: `PUT /api/cart/update`  
**Auth**: Customer Required  

```bash
curl -X PUT http://localhost:5000/api/cart/update \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_id": "66a1b2c3d4e5f6789abcdef0",
    "quantity": 3
  }'
```

### 42. Remove from Cart
**Purpose**: Remove specific item from cart  
**Route**: `DELETE /api/cart/remove/:item_id`  
**Auth**: Customer Required  

```bash
curl -X DELETE http://localhost:5000/api/cart/remove/66a1b2c3d4e5f6789abcdef0 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 43. Clear Cart
**Purpose**: Remove all items from cart  
**Route**: `DELETE /api/cart/clear`  
**Auth**: Customer Required  

```bash
curl -X DELETE http://localhost:5000/api/cart/clear \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

---

## 🛍️ **CHECKOUT ROUTES**

### 44. Start Checkout
**Purpose**: Initialize checkout process  
**Route**: `POST /api/checkout/start`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/checkout/start \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json"
```

### 45. Add Shipping Method
**Purpose**: Set shipping method for checkout  
**Route**: `POST /api/checkout/shipping`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/checkout/shipping \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkout_id": "66a1b2c3d4e5f6789abcdef1",
    "shipping_method": "Standard Shipping",
    "shipping_code": "standard"
  }'
```

### 46. Add Payment Method
**Purpose**: Set payment method for checkout  
**Route**: `POST /api/checkout/payment`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/checkout/payment \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkout_id": "66a1b2c3d4e5f6789abcdef1",
    "payment_method": "Credit Card",
    "payment_code": "credit_card"
  }'
```

### 47. Apply Coupon
**Purpose**: Apply discount coupon to checkout  
**Route**: `POST /api/checkout/apply-coupon`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/checkout/apply-coupon \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkout_id": "66a1b2c3d4e5f6789abcdef1",
    "coupon_code": "SAVE10"
  }'
```

### 48. Complete Checkout
**Purpose**: Finalize order and create order record  
**Route**: `POST /api/checkout/complete`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/checkout/complete \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkout_id": "66a1b2c3d4e5f6789abcdef1",
    "comment": "Please deliver to front door"
  }'
```

---

## 📋 **ORDER MANAGEMENT ROUTES**

### 49. Get Customer Orders
**Purpose**: Get orders for authenticated customer  
**Route**: `GET /api/orders/my-orders`  
**Auth**: Customer Required  

```bash
curl -X GET "http://localhost:5000/api/orders/my-orders?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 50. Get Order Details
**Purpose**: Get detailed order information  
**Route**: `GET /api/orders/details/:id`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/orders/details/1001 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 51. Get All Orders (Admin)
**Purpose**: Get all orders with advanced filtering  
**Route**: `GET /api/orders`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/orders?page=1&limit=20&status=1&customer_id=123&date_from=2024-01-01&date_to=2024-12-31&search=john" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 52. Update Order Status (Admin)
**Purpose**: Change order status with notification  
**Route**: `PUT /api/orders/status/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/orders/status/1001 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "order_status_id": 3,
    "comment": "Order shipped via UPS tracking: 1Z123456789",
    "notify_customer": true
  }'
```

### 53. Get Order Analytics (Admin)
**Purpose**: Get order statistics and trends  
**Route**: `GET /api/orders/analytics`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/orders/analytics?days=30" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 54. Get Order Statuses
**Purpose**: Get list of available order statuses  
**Route**: `GET /api/orders/statuses`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/orders/statuses \
  -H "Content-Type: application/json"
```

---

## 🔍 **SEARCH & DISCOVERY ROUTES**

### 55. Search Products
**Purpose**: Advanced product search with filters  
**Route**: `GET /api/search`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/search?query=gaming laptop&category=20&manufacturer=8&price_min=500&price_max=2000&sort=price_asc&page=1&limit=12&in_stock=true&has_image=true&on_sale=false" \
  -H "Content-Type: application/json"
```

### 56. Get Search Suggestions
**Purpose**: Get autocomplete suggestions for search  
**Route**: `GET /api/search/suggestions`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/search/suggestions?q=lap&limit=10" \
  -H "Content-Type: application/json"
```

### 57. Get Search Filters
**Purpose**: Get available filters for search results  
**Route**: `GET /api/search/filters`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/search/filters?query=laptop&category=20" \
  -H "Content-Type: application/json"
```

### 58. Get Popular Searches
**Purpose**: Get trending/popular search terms  
**Route**: `GET /api/search/popular`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/search/popular?days=30&limit=10" \
  -H "Content-Type: application/json"
```

### 59. Get Search Analytics (Admin)
**Purpose**: Get search statistics and analytics  
**Route**: `GET /api/search/analytics`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/search/analytics?days=30&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🎫 **COUPON MANAGEMENT ROUTES**

### 60. Get All Coupons (Admin)
**Purpose**: Get list of all coupons  
**Route**: `GET /api/coupons`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/coupons \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 61. Get Coupon by Code
**Purpose**: Validate and get coupon details  
**Route**: `GET /api/coupons/:code`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/coupons/SAVE10 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 62. Create Coupon (Admin)
**Purpose**: Create new discount coupon  
**Route**: `POST /api/coupons`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/coupons \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Sale 2024",
    "code": "SUMMER2024",
    "type": "P",
    "discount": 15,
    "total": 100,
    "date_start": "2024-06-01",
    "date_end": "2024-08-31",
    "uses_total": 1000,
    "uses_customer": 1,
    "status": true,
    "products": [],
    "categories": [20, 18]
  }'
```

### 63. Update Coupon (Admin)
**Purpose**: Update existing coupon  
**Route**: `PUT /api/coupons/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/coupons/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "discount": 20,
    "uses_total": 2000,
    "status": false
  }'
```

### 64. Delete Coupon (Admin)
**Purpose**: Remove coupon from system  
**Route**: `DELETE /api/coupons/:id`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/coupons/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📍 **LOCATION SERVICES ROUTES**

### 65. Get Countries
**Purpose**: Get list of countries with filters  
**Route**: `GET /api/locations/countries`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/locations/countries?status=true&search=united&page=1&limit=50" \
  -H "Content-Type: application/json"
```

### 66. Get Zones by Country
**Purpose**: Get states/provinces for specific country  
**Route**: `GET /api/locations/zones/:country_id`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/locations/zones/223 \
  -H "Content-Type: application/json"
```

---

## 📊 **ANALYTICS ROUTES (ADMIN ONLY)**

### 67. System Overview
**Purpose**: Get dashboard overview statistics  
**Route**: `GET /api/analytics/overview`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/analytics/overview \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 68. Online Users
**Purpose**: Get currently active users  
**Route**: `GET /api/analytics/online-users`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/analytics/online-users?page=1&limit=20&user_type=customer&country=United States" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 69. User Activity
**Purpose**: Get user activity logs  
**Route**: `GET /api/analytics/user-activity`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/analytics/user-activity?user_id=123&activity_type=login&date_from=2024-01-01&page=1&limit=50" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 70. Search Analytics
**Purpose**: Get search behavior analytics  
**Route**: `GET /api/analytics/searches`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/analytics/searches?days=30&query=laptop&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 71. Audit Logs
**Purpose**: Get system audit logs  
**Route**: `GET /api/analytics/audit-logs`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/analytics/audit-logs?user_type=admin&action=create&entity_type=product&date_from=2024-01-01&limit=100" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 72. User Locations
**Purpose**: Get geographic user distribution  
**Route**: `GET /api/analytics/user-locations`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/analytics/user-locations?days=30&user_type=customer" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🏢 **ADMIN MANAGEMENT ROUTES**

### 73. Get Admin Profile
**Purpose**: Get authenticated admin's profile  
**Route**: `GET /api/admin/profile`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/admin/profile \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 74. Update Admin
**Purpose**: Update admin account information  
**Route**: `PUT /api/admin/update/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/admin/update/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "firstname": "Updated First",
    "lastname": "Updated Last",
    "email": "admin.updated@example.com"
  }'
```

### 75. Change Admin Password
**Purpose**: Change admin account password  
**Route**: `POST /api/admin/change-password`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/admin/change-password \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_password": "oldpassword",
    "new_password": "newpassword123"
  }'
```

### 76. Get All Admins
**Purpose**: Get list of all admin accounts  
**Route**: `GET /api/admin/all`  
**Auth**: Super Admin Required  

```bash
curl -X GET http://localhost:5000/api/admin/all \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN"
```

---

## 📝 **REVIEW ROUTES**

### 77. Get Product Reviews
**Purpose**: Get reviews for specific product  
**Route**: `GET /api/reviews/product/:product_id`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/reviews/product/42 \
  -H "Content-Type: application/json"
```

### 78. Add Review
**Purpose**: Submit product review  
**Route**: `POST /api/reviews/add`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/reviews/add \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 42,
    "rating": 5,
    "text": "Excellent product! Highly recommended for gaming. Fast delivery and great customer service."
  }'
```

---

## 💝 **WISHLIST ROUTES**

### 79. Get Wishlist
**Purpose**: Get customer's wishlist items  
**Route**: `GET /api/wishlist`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/wishlist \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 80. Add to Wishlist
**Purpose**: Add product to wishlist  
**Route**: `POST /api/wishlist/add`  
**Auth**: Customer Required  

```bash
curl -X POST http://localhost:5000/api/wishlist/add \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_id": 42
  }'
```

### 81. Remove from Wishlist
**Purpose**: Remove product from wishlist  
**Route**: `DELETE /api/wishlist/remove/:product_id`  
**Auth**: Customer Required  

```bash
curl -X DELETE http://localhost:5000/api/wishlist/remove/42 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

---

## 🛠️ **BACKUP & SYSTEM ROUTES**

### 82. Create Backup (Admin)
**Purpose**: Create database backup  
**Route**: `POST /api/backup`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/backup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "daily_backup"
  }'
```

### 83. List Backups (Admin)
**Purpose**: Get list of available backups  
**Route**: `GET /api/backup`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/backup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 84. Restore Backup (Admin)
**Purpose**: Restore database from backup  
**Route**: `POST /api/backup/restore/:backupName`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/backup/restore/daily_backup_2024-05-25 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 85. Delete Backup (Admin)
**Purpose**: Remove backup file  
**Route**: `DELETE /api/backup/:backupName`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/backup/daily_backup_2024-05-25 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📚 **DOCUMENTATION & HEALTH ROUTES**

### 86. API Health Check
**Purpose**: Check API server status  
**Route**: `GET /health`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/health \
  -H "Content-Type: application/json"
```

### 87. API Documentation
**Purpose**: Get API endpoint documentation  
**Route**: `GET /api/docs`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/docs \
  -H "Content-Type: application/json"
```

### 88. API Endpoints List
**Purpose**: Get list of all available endpoints  
**Route**: `GET /api`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api \
  -H "Content-Type: application/json"
```

---

## 🏭 **MANUFACTURER ROUTES**

### 89. Get All Manufacturers
**Purpose**: Get list of product manufacturers  
**Route**: `GET /api/manufacturers`  
**Auth**: Public  

```bash
curl -X GET http://localhost:5000/api/manufacturers \
  -H "Content-Type: application/json"
```

### 90. Get Manufacturer by ID
**Purpose**: Get manufacturer details with products  
**Route**: `GET /api/manufacturers/:id`  
**Auth**: Public  

```bash
curl -X GET "http://localhost:5000/api/manufacturers/8?page=1&limit=10" \
  -H "Content-Type: application/json"
```

### 91. Create Manufacturer (Admin)
**Purpose**: Add new manufacturer  
**Route**: `POST /api/manufacturers`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/manufacturers \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tech Corp",
    "image": "catalog/manufacturers/tech-corp.jpg",
    "sort_order": 1
  }'
```

### 92. Update Manufacturer (Admin)
**Purpose**: Update manufacturer information  
**Route**: `PUT /api/manufacturers/:id`  
**Auth**: Admin Required  

```bash
curl -X PUT http://localhost:5000/api/manufacturers/8 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Tech Corp",
    "sort_order": 2
  }'
```

### 93. Delete Manufacturer (Admin)
**Purpose**: Remove manufacturer  
**Route**: `DELETE /api/manufacturers/:id`  
**Auth**: Admin Required  

```bash
curl -X DELETE http://localhost:5000/api/manufacturers/8 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📄 **UPLOAD & DOWNLOAD ROUTES**

### 94. Get Downloadable Products
**Purpose**: Get customer's downloadable products  
**Route**: `GET /api/downloads/products`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/downloads/products \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 95. Download File
**Purpose**: Download purchased digital product  
**Route**: `GET /api/downloads/file/:downloadId`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/downloads/file/123 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 96. Get Uploaded File
**Purpose**: Access uploaded option file  
**Route**: `GET /api/uploads/file/:filename`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/uploads/file/custom_design.pdf \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

### 97. Get Product Uploads
**Purpose**: List uploaded files for product  
**Route**: `GET /api/uploads/product/:product_id`  
**Auth**: Customer Required  

```bash
curl -X GET http://localhost:5000/api/uploads/product/42 \
  -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN"
```

---

## 🌍 **ADDITIONAL LOCATION ROUTES**

### 98. Get All Countries (Admin)
**Purpose**: Admin management of countries  
**Route**: `GET /api/countries`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/countries?page=1&limit=50&status=true&search=united" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 99. Create Country (Admin)
**Purpose**: Add new country  
**Route**: `POST /api/countries`  
**Auth**: Admin Required  

```bash
curl -X POST http://localhost:5000/api/countries \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Country",
    "iso_code_2": "NC",
    "iso_code_3": "NCT",
    "address_format": "{firstname} {lastname}\n{address_1}\n{city}, {zone} {postcode}\n{country}",
    "postcode_required": true,
    "status": true
  }'
```

### 100. Get All Zones (Admin)
**Purpose**: Admin management of zones  
**Route**: `GET /api/zones`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/zones?country_id=223&status=true&search=california" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🎯 **DASHBOARD ROUTES (ADMIN ONLY)**

### 101. Sales Revenue
**Purpose**: Get sales revenue analytics  
**Route**: `GET /api/dashboard/sales`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/sales?days=30" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 102. New Orders
**Purpose**: Get recent orders  
**Route**: `GET /api/dashboard/orders/new`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/orders/new?days=7" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 103. New Customers
**Purpose**: Get new customer registrations  
**Route**: `GET /api/dashboard/customers/new`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/customers/new?days=30" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 104. Online Customers
**Purpose**: Get currently online customers  
**Route**: `GET /api/dashboard/customers/online`  
**Auth**: Admin Required  

```bash
curl -X GET http://localhost:5000/api/dashboard/customers/online \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 105. Yearly Revenue
**Purpose**: Get monthly revenue breakdown  
**Route**: `GET /api/dashboard/revenue/yearly`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/revenue/yearly?year=2024" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 106. Top Products
**Purpose**: Get best selling products  
**Route**: `GET /api/dashboard/products/top`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/products/top?days=30&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 107. Recent Orders
**Purpose**: Get latest orders with details  
**Route**: `GET /api/dashboard/orders/recent`  
**Auth**: Admin Required  

```bash
curl -X GET "http://localhost:5000/api/dashboard/orders/recent?limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 🔧 **ENVIRONMENT VARIABLES**

For all these routes to work properly, ensure these environment variables are set:

```bash
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/opencart_api_new
JWT_SECRET=supersecretkey
JWT_REFRESH_SECRET=refreshsupersecretkey
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=your-email@gmail.com
EMAIL_FROM_NAME=OpenCart Store
DOWNLOAD_DIR=./downloads
UPLOAD_DIR=./uploads
```

---

## 📋 **QUICK TEST COMMANDS**

### Start Server
```bash
npm run dev
```

### Test API Health
```bash
curl http://localhost:5000/health
```

### Get API Docs
```bash
curl http://localhost:5000/api-docs
```

### Test Admin Login
```bash
curl -X POST http://localhost:5000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'
```

---

**Total Routes: 107 endpoints**  
**Authentication Required: 75 routes**  
**Admin Only: 35 routes**  
**Public Access: 32 routes**