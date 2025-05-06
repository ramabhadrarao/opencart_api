// routes/product.routes.js
import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Product route working!' });
});

export default router;
