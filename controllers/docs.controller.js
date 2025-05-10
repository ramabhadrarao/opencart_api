// controllers/docs.controller.js
export const getApiDocs = (req, res) => {
  res.json({
    api_name: "OpenCart REST API",
    version: "1.0",
    base_url: "/api",
    endpoints: [
      {
        path: "/customers",
        methods: [
          { method: "POST", endpoint: "/login", description: "Customer login" },
          { method: "GET", endpoint: "/profile", description: "Get customer profile (requires auth)" },
          { method: "POST", endpoint: "/forgot-password", description: "Request password reset" },
          { method: "POST", endpoint: "/reset-password", description: "Reset password with token" }
        ]
      },
      {
        path: "/products",
        methods: [
          { method: "GET", endpoint: "/", description: "Get all products with pagination", params: "?page=1&limit=10&category=123&search=keyword" },
          { method: "GET", endpoint: "/:id", description: "Get single product by ID" }
        ]
      },
      {
        path: "/categories",
        methods: [
          { method: "GET", endpoint: "/", description: "Get all categories" },
          { method: "GET", endpoint: "/:id", description: "Get category with products", params: "?page=1&limit=10" }
        ]
      },
      {
        path: "/cart",
        methods: [
          { method: "GET", endpoint: "/", description: "Get customer cart (requires auth)" },
          { method: "POST", endpoint: "/add", description: "Add product to cart (requires auth)" },
          { method: "PUT", endpoint: "/update", description: "Update cart item quantity (requires auth)" },
          { method: "DELETE", endpoint: "/remove/:item_id", description: "Remove item from cart (requires auth)" },
          { method: "DELETE", endpoint: "/clear", description: "Clear cart (requires auth)" }
        ]
      },
      {
        path: "/orders",
        methods: [
          { method: "GET", endpoint: "/my-orders", description: "Get customer orders (requires auth)" },
          { method: "GET", endpoint: "/details/:id", description: "Get order details (requires auth)" }
        ]
      },
      {
        path: "/downloads",
        methods: [
          { method: "GET", endpoint: "/products", description: "Get downloadable products (requires auth)" },
          { method: "GET", endpoint: "/file/:downloadId", description: "Download a file (requires auth)" }
        ]
      },
      {
        path: "/checkout",
        methods: [
          { method: "POST", endpoint: "/start", description: "Start checkout process (requires auth)" },
          { method: "POST", endpoint: "/shipping", description: "Add shipping method (requires auth)" },
          { method: "POST", endpoint: "/payment", description: "Add payment method (requires auth)" },
          { method: "POST", endpoint: "/complete", description: "Complete checkout (requires auth)" }
        ]
      }
    ]
  });
};