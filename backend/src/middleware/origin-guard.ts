import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../shared/errors/app-error.js';
const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
export const originGuard: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (unsafeMethods.has(req.method) && origin && origin !== env.WEB_ORIGIN) return next(new AppError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed'));
  next();
};
