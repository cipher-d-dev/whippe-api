import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.isOperational = true;
  return err;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      message: 'Validation error',
      errors: err.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  const statusCode = err.statusCode ?? 500;
  const message = err.isOperational ? err.message : 'Internal server error';

  // Include stack trace in development only
  const body: Record<string, unknown> = { success: false, message };
  if (env.NODE_ENV === 'development' && !err.isOperational) {
    body.stack = err.stack;
  }

  if (statusCode >= 500) {
    console.error('Server error:', err);
  }

  res.status(statusCode).json(body);
}
