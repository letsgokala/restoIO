import { app } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
const server = app.listen(env.API_PORT, () => console.log(`API listening on http://localhost:${env.API_PORT}`));
const shutdown = async () => { server.close(); await prisma.$disconnect(); };
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
