// routes/docs.routes.js
import express from 'express';
import { getApiDocs } from '../controllers/docs.controller.js';

const router = express.Router();

router.get('/', getApiDocs);

export default router;