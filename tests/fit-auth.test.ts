import { buildServer } from '../src/server';
import { generateKeyPair, SignJWT } from 'jose';
import { config } from '../src/config';

describe('Atlassian Forge Remote - FIT Authentication Security Tests', () => {
  const app = buildServer();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should reject requests missing Authorization header with 401 UNAUTHORIZED', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/incidents',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('should reject tokens with invalid issuer (not forge/invocation-token)', async () => {
    const { privateKey } = await generateKeyPair('RS256');

    // Create token with rogue issuer
    const token = await new SignJWT({
      app: { id: config.forgeAppId },
      installation: { id: 'inst-test-123' },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('https://rogue-issuer.com') // Invalid issuer!
      .setAudience(config.forgeAppAri)
      .setExpirationTime('1h')
      .sign(privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/incidents',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_FORGE_INVOCATION_TOKEN');
  });

  it('should reject tokens with wrong audience', async () => {
    const { privateKey } = await generateKeyPair('RS256');

    const token = await new SignJWT({
      app: { id: config.forgeAppId },
      installation: { id: 'inst-test-123' },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('forge/invocation-token')
      .setAudience('ari:cloud:ecosystem::app/unauthorized-app-999') // Wrong audience!
      .setExpirationTime('1h')
      .sign(privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/incidents',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('INVALID_FORGE_INVOCATION_TOKEN');
  });

  it('should reject expired invocation tokens', async () => {
    const { privateKey } = await generateKeyPair('RS256');

    const token = await new SignJWT({
      app: { id: config.forgeAppId },
      installation: { id: 'inst-test-123' },
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-1' })
      .setIssuer('forge/invocation-token')
      .setAudience(config.forgeAppAri)
      .setExpirationTime('-10s') // Already expired!
      .sign(privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/incidents',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
  });
});
