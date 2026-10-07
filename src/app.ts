import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { notFound } from './middleware/not-found';

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  }),
);

// Global rate-limit: 200 req / 15 min per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Whippe API is running',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ─── API routes (domain modules registered here in later phases) ─────────────
// e.g. app.use('/api/v1/auth', authRouter);
//      app.use('/api/v1/users', usersRouter);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global error handler (must be last) ─────────────────────────────────────
app.use(errorHandler);

export default app;
