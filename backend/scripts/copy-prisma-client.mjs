import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const generatedClient = resolve(backendRoot, 'src/generated/prisma');
const compiledClient = resolve(backendRoot, 'dist/src/generated/prisma');

await rm(compiledClient, { recursive: true, force: true });
await mkdir(dirname(compiledClient), { recursive: true });
await cp(generatedClient, compiledClient, { recursive: true });
