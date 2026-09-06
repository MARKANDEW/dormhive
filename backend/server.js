import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import os from 'node:os';
import { statfs } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pool from './core/config/database.js';
import apiRoutes from './core/routes/index.js';
import { errorHandler, notFound } from './core/middleware/errorHandler.js';

const app = express();
const backendDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadsDirectory = path.join(backendDirectory, 'core', 'uploads');
const serverStartedAt = Date.now();
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
  legacyHeaders: false,
  handler: (_request, response) => response.status(429).json({ message: 'Too many requests. Please try again later.' })
}));
app.use('/uploads', express.static(uploadsDirectory));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/api/v1/health', async (_request, response) => {
  const checkedAt = new Date().toISOString();
  const databaseStartedAt = process.hrtime.bigint();
  let database;
  try {
    await pool.query('SELECT 1');
    database = {
      status: 'healthy',
      responseMs: Number(process.hrtime.bigint() - databaseStartedAt) / 1_000_000
    };
  } catch (error) {
    database = { status: 'down', responseMs: null, error: error.message };
  }

  let storage;
  try {
    const filesystem = await statfs(uploadsDirectory);
    const totalBytes = Number(filesystem.blocks) * Number(filesystem.bsize);
    const availableBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    storage = {
      status: 'healthy',
      usedPercent: totalBytes ? Math.round(((totalBytes - availableBytes) / totalBytes) * 100) : 0,
      availableBytes
    };
  } catch (error) {
    storage = { status: 'down', usedPercent: null, availableBytes: null, error: error.message };
  }

  const memory = process.memoryUsage();
  const systemMemory = {
    totalBytes: os.totalmem(),
    freeBytes: os.freemem()
  };
  const systemMemoryUsedPercent = Math.round(((systemMemory.totalBytes - systemMemory.freeBytes) / systemMemory.totalBytes) * 100);
  const services = {
    api: { status: 'healthy', uptimeSeconds: process.uptime() },
    database,
    authentication: { status: process.env.JWT_SECRET ? 'healthy' : 'degraded' },
    storage,
    notifications: { status: 'healthy' },
    webServer: { status: 'healthy', uptimeSeconds: process.uptime() }
  };
  const hasFailure = Object.values(services).some((service) => service.status === 'down');
  const hasWarning = Object.values(services).some((service) => service.status === 'degraded');

  response.status(200).json({
    status: hasFailure ? 'degraded' : hasWarning ? 'warning' : 'ok',
    service: 'dormhive-api',
    checkedAt,
    uptimeSeconds: Math.floor((Date.now() - serverStartedAt) / 1000),
    services,
    system: {
      platform: process.platform,
      nodeVersion: process.version,
      cpuCount: os.cpus().length,
      loadAverage: os.loadavg()[0],
      memoryUsedPercent: systemMemoryUsedPercent,
      processMemoryMb: Math.round(memory.rss / 1024 / 1024)
    }
  });
});

app.use('/api/v1', apiRoutes);
app.use(notFound);
app.use(errorHandler);

app.listen(port, () => {
  console.log(`DormHive API listening on port ${port}`);
});
