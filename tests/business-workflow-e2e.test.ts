import { runEndToEndVerification } from '../scripts/verify-business-workflow';

describe('AuditTrail AI — Phase 3 Complete End-to-End Business Workflow Integration', () => {
  it('should execute and pass the complete 6-point medical device quality workflow over live HTTP and database', async () => {
    const result = await runEndToEndVerification();

    expect(result.allPassed).toBe(true);
    expect(result.evidenceList.length).toBe(6);
    for (const e of result.evidenceList) {
      expect(e.status).toBe('PASS');
      expect(e.httpStatus).toBeGreaterThanOrEqual(200);
      expect(e.httpStatus).toBeLessThan(300);
    }

    expect(result.negativeTests.length).toBe(5);
    for (const n of result.negativeTests) {
      expect(n.status).toBe('PASS');
    }

    expect(result.records.incidentId).toBeDefined();
    expect(result.records.investigationId).toBeDefined();
    expect(result.records.capaId).toBeDefined();
    expect(result.records.documentId).toBeDefined();
    expect(result.records.signatureId).toBeDefined();
    expect(result.records.auditEventId).toBeDefined();
  }, 30000);
});
