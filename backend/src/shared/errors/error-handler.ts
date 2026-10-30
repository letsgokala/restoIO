import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from './app-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const requestId = req.requestId;
  if (error instanceof AppError) {
    res.status(error.status).json({ error: { code: error.code, message: error.message, requestId, ...(error.details ? { details: error.details } : {}) } });
    return;
  }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', requestId, details: error.flatten() } });
    return;
  }
  console.error(JSON.stringify({ level: 'error', requestId, message: error instanceof Error ? error.message : 'Unknown error' }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } });
};
