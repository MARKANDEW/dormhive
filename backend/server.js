import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import apiRoutes from './core/routes/index.js';
import { errorHandler, notFound } from './core/middleware/errorHandler.js';

const app = express();
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.join(backendDirectory, 'core', 'uploads');
const port = Number.parseInt(process.env.PORT ?? '5000', 10);
const allowedOrigins = (process.env.CLIENT_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin = '') => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);

app.disable('x-powered-by');
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // allow images from same origin, data URIs, and common local dev origins
      "img-src": ["'self'", 'data:', 'http://localhost:3000', 'http://localhost:49843', 'http://localhost:5000']
    }
  }
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true
}));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false
}));
app.use('/uploads', express.static(uploadsDirectory));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'dormhive-api' });
});

app.use('/api/v1', apiRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`DormHive API listening on port ${port}`);
});
