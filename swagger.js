// swagger.js
import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'OpenCart REST API',
    version: '1.0.0',
    description: 'API for OpenCart e-commerce system',
    contact: {
      name: 'API Support',
      email: 'support@example.com'
    },
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ['./routes/*.js', './controllers/*.js', './models/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec;