import type { RequestHandler } from 'express';

const redactGuestSecrets = (path: string) => path
  .replace(/(\/customer\/qr\/)[^/]+/g, '$1[redacted]')
  .replace(/(\/customer\/orders\/)[^/]+/g, '$1[redacted]')
  .replace(/(\/customer\/assistance\/)[^/]+/g, '$1[redacted]');

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = performance.now();
  const path = new URL(req.originalUrl, 'http://localhost').pathname;
  res.once('finish', () => {
    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      requestId: req.requestId,
      method: req.method,
      path: redactGuestSecrets(path),
      statusCode: res.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    }));
  });
  next();
};
