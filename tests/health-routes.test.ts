import { buildServer } from '../src/server';

describe('AuditTrail AI - Health Endpoints & Diagnostics', () => {
  const app = buildServer();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health - should return UP with service metadata', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('UP');
    expect(body.service).toBe('audittrail-ai-remote-backend');
    expect(body.version).toBe('2.1.0');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /health/ready - should verify database connectivity and pool status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health/ready',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('READY');
    expect(body.database).toBe('CONNECTED');
    expect(body.pool).toBeDefined();
    expect(typeof body.latencyMs).toBe('number');
  });

  it('GET /api/v1/health/database - should return schema statistics without leaking credentials', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health/database',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('UP');
    expect(body.database).toBe('CONNECTED');
    expect(body.applicationRole).toBe('audittrail_app');
    expect(body.totalTables).toBe(38);
    expect(body.rlsEnforcedTables).toBe(37);
    expect(body.password).toBeUndefined();
    expect(body.databaseUrl).toBeUndefined();
  });
});
