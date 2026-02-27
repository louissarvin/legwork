import './dotenv.ts';

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import FastifyCors from '@fastify/cors';
import { APP_PORT } from './src/config/main-config.ts';

// Routes
import { taskRoutes } from './src/routes/taskRoutes.ts';
import { submissionRoutes } from './src/routes/submissionRoutes.ts';
import { workerRoutes } from './src/routes/workerRoutes.ts';
import { dashboardRoutes } from './src/routes/dashboardRoutes.ts';
import { agentRoutes } from './src/routes/agentRoutes.ts';
import { t402Routes } from './src/routes/t402Routes.ts';
import { clientRoutes } from './src/routes/clientRoutes.ts';

// Workers
import { startErrorLogCleanupWorker } from './src/workers/errorLogCleanup.ts';
import { startAgentWorker } from './src/workers/agentWorker.ts';

// WDK
import { disposeWdk } from './src/lib/wdk/setup.ts';

console.log(
  '======================\nLegwork Backend Started!\n======================\n'
);

const fastify = Fastify({
  logger: false,
  bodyLimit: 10 * 1024 * 1024, // 10MB for photo uploads
});

fastify.register(FastifyCors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'token', 'payment-signature'],
});

// Health check
fastify.get('/', async (_request: FastifyRequest, reply: FastifyReply) => {
  return reply.status(200).send({
    success: true,
    message: 'Legwork API is running',
    error: null,
    data: { version: '1.0.0', network: 'sepolia' },
  });
});

// Register routes
fastify.register(taskRoutes, { prefix: '/tasks' });
fastify.register(submissionRoutes, { prefix: '/submissions' });
fastify.register(workerRoutes, { prefix: '/workers' });
fastify.register(dashboardRoutes, { prefix: '/dashboard' });
fastify.register(agentRoutes, { prefix: '/agent' });
fastify.register(t402Routes, { prefix: '/t402' });
fastify.register(clientRoutes, { prefix: '/clients' });

const start = async (): Promise<void> => {
  try {
    startErrorLogCleanupWorker();
    startAgentWorker();

    await fastify.listen({
      port: APP_PORT,
      host: '0.0.0.0',
    });

    const address = fastify.server.address();
    const port = typeof address === 'object' && address ? address.port : APP_PORT;

    console.log(`Server started on port ${port}`);
    console.log(`http://localhost:${port}`);
  } catch (error) {
    console.log('Error starting server: ', error);
    disposeWdk();
    process.exit(1);
  }
};

// Cleanup on shutdown
process.on('SIGINT', () => {
  disposeWdk();
  process.exit(0);
});

process.on('SIGTERM', () => {
  disposeWdk();
  process.exit(0);
});

start();
