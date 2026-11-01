import crypto from 'crypto';
import { AuditService, canonicalizeJson } from '../src/services/audit-service';

describe('Audit Ledger - Concurrency & Cryptographic Chain Verification Tests', () => {
  const tenantId = 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

  it('should detect a broken hash chain when an event payload has been altered', async () => {
    // Generate valid sequence 1 with exact cryptographic hash
    const seq1 = {
      sequence_number: '1',
      previous_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      entity_name: 'incidents',
      entity_id: 'i111',
      action: 'INSERT',
      actor_id: 'u111',
      before_state: null,
      after_state: { status: 'SUBMITTED' },
      reason_for_change: 'Intake',
      created_at_iso: '2026-10-18T14:00:00.000000Z',
    };
    const seq1Payload = `${seq1.previous_event_hash}|${seq1.sequence_number}|${tenantId}|${seq1.entity_name}|${seq1.entity_id}|${seq1.action}|${seq1.actor_id}|{}|${canonicalizeJson(seq1.after_state)}|${seq1.reason_for_change}|${seq1.created_at_iso}`;
    const seq1Hash = crypto.createHash('sha256').update(seq1Payload).digest('hex');

    // Mock database rows where sequence 2 has been tampered with by an attacker
    const mockClient: any = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            ...seq1,
            event_hash: seq1Hash,
          },
          {
            sequence_number: '2',
            previous_event_hash: seq1Hash,
            event_hash: '1111111111111111111111111111111111111111111111111111111111111111', // Fake hash!
            entity_name: 'incidents',
            entity_id: 'i111',
            action: 'UPDATE',
            actor_id: 'u222',
            before_state: { status: 'SUBMITTED' },
            after_state: { status: 'CLOSED' }, // Tampered state
            reason_for_change: 'Unauthorized modification',
            created_at_iso: '2026-10-18T14:30:00.000000Z',
          },
        ],
      }),
    };

    const verification = await AuditService.verifyTenantChain(mockClient, tenantId, 1, 2);

    expect(verification.isValid).toBe(false);
    expect(verification.brokenSequenceNumber).toBe(2);
    expect(verification.failureReason).toContain('TAMPER_DETECTED');
  });

  it('should detect a missing sequence gap in the audit trail', async () => {
    const seq1 = {
      sequence_number: '1',
      previous_event_hash: '0000000000000000000000000000000000000000000000000000000000000000',
      entity_name: 'incidents',
      entity_id: 'i111',
      action: 'INSERT',
      actor_id: null,
      before_state: null,
      after_state: null,
      reason_for_change: null,
      created_at_iso: '2026-10-18T14:00:00.000000Z',
    };
    const seq1Payload = `${seq1.previous_event_hash}|${seq1.sequence_number}|${tenantId}|${seq1.entity_name}|${seq1.entity_id}|${seq1.action}|SYSTEM|{}|{}||${seq1.created_at_iso}`;
    const seq1Hash = crypto.createHash('sha256').update(seq1Payload).digest('hex');

    const mockClient: any = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            ...seq1,
            event_hash: seq1Hash,
          },
          // Sequence 2 is missing! Sequence 3 follows
          {
            sequence_number: '3',
            previous_event_hash: 'hash2',
            event_hash: 'hash3',
            entity_name: 'incidents',
            entity_id: 'i111',
            action: 'STATUS_CHANGE',
            created_at_iso: '2026-10-18T14:45:00.000000Z',
          },
        ],
      }),
    };

    const verification = await AuditService.verifyTenantChain(mockClient, tenantId, 1, 3);

    expect(verification.isValid).toBe(false);
    expect(verification.brokenSequenceNumber).toBe(2);
    expect(verification.failureReason).toContain('SEQUENCE_GAP_DETECTED');
  });
});
