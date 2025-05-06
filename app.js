// app.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectMongoDB } from './config/db.js';

import customerRoutes from './routes/customer.routes.js';
import productRoutes from './routes/product.routes.js';
import orderRoutes from './routes/order.routes.js';

// ... other route imports

dotenv.config();
const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

// ... other routes

const PORT = process.env.PORT || 5000;

connectMongoDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
