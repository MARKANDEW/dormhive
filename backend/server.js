import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import apiRoutes from './routes/index.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const port = Number.parseInt(process.env.PORT ?? '5000', 10);
const allowedOrigins = (process.env.CLIENT_URL ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const isLocalDevOrigin = (origin = '') => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/i.test(origin);

app.disable('x-powered-by');
app.use(helmet());
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
app.use('/uploads', express.static(path.resolve('uploads')));
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
