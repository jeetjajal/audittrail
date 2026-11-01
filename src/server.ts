import Fastify, { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Pool } from 'pg';
import { config } from './config';
import { dbPool, resolveTenantOrganization } from './middleware/tenant-context';
import { verifyForgeInvocationToken } from './middleware/fit-verifier';
import { healthRoutes } from './routes/health';
import { incidentRoutes } from './routes/incidents';
import { investigationRoutes } from './routes/investigations';
import { capaRoutes } from './routes/capas';
import { evidenceRoutes } from './routes/evidence';
import { approvalRoutes } from './routes/approvals';
import { signatureRoutes } from './routes/signatures';
import { aiRoutes } from './routes/ai';
import { auditRoutes } from './routes/audit';
import { analyticsRoutes } from './routes/analytics';
import { organizationRoutes } from './routes/organization';
import { userRoutes } from './routes/users';

declare module 'fastify' {
  interface FastifyInstance {
    pgPool: Pool;
  }
}

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.environment === 'production' ? 'info' : 'debug',
      serializers: {
        req(req) {
          return {
            method: req.method,
            url: req.url,
            correlationId: req.correlationId,
          };
        },
      },
    },
    trustProxy: true,
  });

  // Attach database pool
  app.decorate('pgPool', dbPool);

  // Correlation ID Middleware
  app.addHook('onRequest', async (req, reply) => {
    req.correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
    reply.header('x-correlation-id', req.correlationId);
  });

  // Register public health checks: /health, /health/ready, /api/v1/health/database
  app.register(healthRoutes);

  // Protected API v1 Subsystem (Enforces official Atlassian Forge FIT validation & Tenant Isolation)
  app.register(async (apiV1) => {
    apiV1.addHook('preHandler', verifyForgeInvocationToken);
    apiV1.addHook('preHandler', resolveTenantOrganization);

    apiV1.register(incidentRoutes, { prefix: '/incidents' });
    apiV1.register(investigationRoutes, { prefix: '/investigations' });
    apiV1.register(capaRoutes, { prefix: '/capas' });
    apiV1.register(evidenceRoutes);
    apiV1.register(approvalRoutes, { prefix: '/approvals' });
    apiV1.register(signatureRoutes, { prefix: '/signatures' });
    apiV1.register(aiRoutes, { prefix: '/ai' });
    apiV1.register(auditRoutes, { prefix: '/audit' });
    apiV1.register(analyticsRoutes, { prefix: '/analytics' });
    apiV1.register(organizationRoutes, { prefix: '/organization' });
    apiV1.register(userRoutes, { prefix: '/users' });
  }, { prefix: '/api/v1' });

  // Local static file serving for React Custom UI exploration
  const frontendBuildDir = path.resolve(__dirname, '..', 'static', 'frontend', 'build');

  app.get('/', async (req, reply) => {
    const indexPath = path.join(frontendBuildDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      reply.type('text/html').send(fs.readFileSync(indexPath, 'utf-8'));
    } else {
      reply.send({ service: 'audittrail-ai-remote-backend', version: '2.1.0', status: 'UP' });
    }
  });

  app.get('/bundle.js', async (req, reply) => {
    const bundlePath = path.join(frontendBuildDir, 'bundle.js');
    if (fs.existsSync(bundlePath)) {
      reply.type('application/javascript').send(fs.readFileSync(bundlePath, 'utf-8'));
    } else {
      reply.status(404).send({ error: 'bundle.js not found' });
    }
  });

  app.get('/bundle.js.map', async (req, reply) => {
    const mapPath = path.join(frontendBuildDir, 'bundle.js.map');
    if (fs.existsSync(mapPath)) {
      reply.type('application/json').send(fs.readFileSync(mapPath, 'utf-8'));
    } else {
      reply.status(404).send({ error: 'sourcemap not found' });
    }
  });

  // Centralized Secure Error Handler (Sanitizes stack traces & DB errors for compliance)
  app.setErrorHandler((error, req, reply) => {
    req.log.error({ err: error, correlationId: req.correlationId }, 'Request execution failed');

    const statusCode = error.statusCode || 500;
    const isProduction = config.environment === 'production';

    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'INTERNAL_SERVER_ERROR',
      message: isProduction && statusCode === 500 ? 'An unexpected internal error occurred' : error.message,
      correlationId: req.correlationId,
    });
  });

  return app;
}

if (require.main === module) {
  const server = buildServer();
  server.listen({ port: config.port, host: config.host }, (err, address) => {
    if (err) {
      server.log.error(err);
      process.exit(1);
    }
    server.log.info(`AuditTrail AI Remote Backend listening on ${address}`);
  });
}
