import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
const server = app.listen(env.API_PORT, '0.0.0.0', () => console.log(`API listening on 0.0.0.0:${env.API_PORT}`));
let isShuttingDown = false;
const shutdown = async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
