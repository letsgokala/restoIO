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
  // Avoid logging raw ORM/driver messages: validation errors can include the full
  // rejected data payload, which may contain passwords or other credentials.
  console.error(JSON.stringify({ level: 'error', requestId, event: 'unhandled_request_error', errorName: error instanceof Error ? error.name : 'UnknownError' }));
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId } });
};
