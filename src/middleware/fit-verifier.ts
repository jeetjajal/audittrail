import { FastifyRequest, FastifyReply } from 'fastify';
import { createRemoteJWKSet, jwtVerify, JWTVerifyOptions } from 'jose';
import { config } from '../config';

// Official FIT remote key set cache
const FIT_JWKS = createRemoteJWKSet(new URL(config.forgeJwksUrl), {
  cooldownDuration: 30000,
  cacheMaxAge: 600000, // 10 minutes
});

export interface AuthenticatedForgeContext {
  installationId: string;
  cloudId?: string;
  appId: string;
  accountId?: string;
  isAppInvocation: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    forgeContext?: AuthenticatedForgeContext;
    tenantOrganizationId?: string;
    correlationId: string;
  }
}

/**
 * Validates Forge Invocation Token (FIT) per official Atlassian Remote documentation
 * Resolves Defect AUD-05
 */
export async function verifyForgeInvocationToken(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  // Development and testing bypass using x-tenant-id header
  if (config.environment !== 'production' && req.headers['x-tenant-id']) {
    req.tenantOrganizationId = req.headers['x-tenant-id'] as string;
    req.forgeContext = {
      installationId: 'test-installation',
      appId: config.forgeAppId,
      isAppInvocation: true,
      accountId: req.headers['x-user-id'] as string | undefined,
    };
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({
      statusCode: 401,
      error: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header with Bearer token',
    });
    return;
  }

  const token = authHeader.substring(7);

  const verifyOptions: JWTVerifyOptions = {
    issuer: 'forge/invocation-token', // Official Atlassian FIT issuer
    audience: config.forgeAppAri,    // Expected App ARI
  };

  try {
    const { payload } = await jwtVerify(token, FIT_JWKS, verifyOptions);

    // Extract official FIT claims
    const appId = (payload.app as { id?: string })?.id;
    if (appId !== config.forgeAppId) {
      reply.status(403).send({
        statusCode: 403,
        error: 'FORBIDDEN_APP_MISMATCH',
        message: 'Invocation token was issued for an unauthorized application ID',
      });
      return;
    }

    const installationId = (payload.installation as { id?: string })?.id;
    if (!installationId) {
      reply.status(401).send({
        statusCode: 401,
        error: 'INVALID_INSTALLATION_CONTEXT',
        message: 'Missing installation identity in invocation token',
      });
      return;
    }

    const context = payload.context as { cloudId?: string } | undefined;
    const principal = payload.principal as { accountId?: string } | undefined;

    req.forgeContext = {
      installationId,
      cloudId: context?.cloudId,
      appId,
      accountId: principal?.accountId,
      isAppInvocation: !principal?.accountId,
    };
  } catch (err) {
    req.log.warn({ err }, 'FIT verification failed');
    reply.status(401).send({
      statusCode: 401,
      error: 'INVALID_FORGE_INVOCATION_TOKEN',
      message: 'Cryptographic signature verification or claim validation failed',
      details: (err as Error).message,
    });
  }
}
