import crypto from 'crypto';
import { canonicalizeJson } from '../src/services/audit-service';

describe('Audit Ledger - RFC 8785 Canonical JSON Serialization (JCS)', () => {
  it('should deterministically sort object keys regardless of original insertion order', () => {
    const objA = { zIndex: 10, alpha: 'test', beta: null, active: true };
    const objB = { active: true, beta: null, zIndex: 10, alpha: 'test' };

    const serializedA = canonicalizeJson(objA);
    const serializedB = canonicalizeJson(objB);

    expect(serializedA).toBe(serializedB);
    expect(serializedA).toBe('{"active":true,"alpha":"test","beta":null,"zIndex":10}');
  });

  it('should canonicalize nested structures and arrays recursively', () => {
    const nested = {
      b: [3, 2, 1],
      a: {
        y: 'world',
        x: 'hello',
      },
    };

    const canonical = canonicalizeJson(nested);
    expect(canonical).toBe('{"a":{"x":"hello","y":"world"},"b":[3,2,1]}');
  });

  it('should compute identical SHA-256 hashes for reordered JSON representations', () => {
    const payload1 = { status: 'UNDER_INVESTIGATION', severity: 'CRITICAL', incident_number: 'INC-2026-0042' };
    const payload2 = { incident_number: 'INC-2026-0042', status: 'UNDER_INVESTIGATION', severity: 'CRITICAL' };

    const hash1 = crypto.createHash('sha256').update(canonicalizeJson(payload1)).digest('hex');
    const hash2 = crypto.createHash('sha256').update(canonicalizeJson(payload2)).digest('hex');

    expect(hash1).toBe(hash2);
  });
});
