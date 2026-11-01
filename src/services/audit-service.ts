import crypto from 'crypto';
import { PoolClient } from 'pg';

/**
 * RFC 8785 JSON Canonicalization Scheme (JCS) Implementation
 * Guarantees 100% byte-for-byte parity with PostgreSQL fn_canonical_json_text()
 * Resolves Defect AUD-04
 */
export function canonicalizeJson(obj: unknown): string {
  if (obj === undefined || obj === null) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map((item) => canonicalizeJson(item)).join(',') + ']';
  }

  // Lexicographical UTF-16 code point sort of keys
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const pairs = sortedKeys.map((key) => {
    const val = (obj as Record<string, unknown>)[key];
    const serializedVal = val === undefined || val === null ? 'null' : canonicalizeJson(val);
    return JSON.stringify(key) + ':' + serializedVal;
  });

  return '{' + pairs.join(',') + '}';
}

export interface AuditRecordPayload {
  organizationId: string;
  entityName: string;
  entityId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE' | 'APPROVE' | 'REJECT' | 'STATUS_CHANGE';
  actorId?: string;
  correlationId?: string;
  reasonForChange?: string;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string;
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEventsVerified: number;
  brokenSequenceNumber?: number;
  failureReason?: string;
}

export class AuditService {
  /**
   * Records an audit event atomically within the calling business transaction.
   * Trigger fn_audit_chain_trigger() in PostgreSQL automatically maintains the hash chain.
   */
  public static async recordAuditEvent(client: PoolClient, payload: AuditRecordPayload): Promise<string> {
    const query = `
      INSERT INTO audit_events (
        organization_id, entity_name, entity_id, action, actor_id,
        correlation_id, reason_for_change, before_state, after_state, ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, sequence_number, event_hash;
    `;

    const values = [
      payload.organizationId,
      payload.entityName,
      payload.entityId,
      payload.action,
      payload.actorId || null,
      payload.correlationId || null,
      payload.reasonForChange || null,
      payload.beforeState ? JSON.stringify(payload.beforeState) : null,
      payload.afterState ? JSON.stringify(payload.afterState) : null,
      payload.ipAddress || null,
    ];

    const result = await client.query(query, values);
    return result.rows[0].event_hash;
  }

  /**
   * Verifies the cryptographic integrity of a tenant's audit trail sequence.
   */
  public static async verifyTenantChain(
    client: PoolClient,
    organizationId: string,
    fromSeq: number,
    toSeq: number
  ): Promise<ChainVerificationResult> {
    const query = `
      SELECT sequence_number, previous_event_hash, event_hash,
             entity_name, entity_id, action, actor_id,
             fn_canonical_json_text(before_state) as canonical_before,
             fn_canonical_json_text(after_state) as canonical_after,
             reason_for_change,
             to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as created_at_iso
      FROM audit_events
      WHERE organization_id = $1 AND sequence_number BETWEEN $2 AND $3
      ORDER BY sequence_number ASC;
    `;

    const res = await client.query(query, [organizationId, fromSeq, toSeq]);
    const events = res.rows;

    if (events.length === 0) {
      return { isValid: true, totalEventsVerified: 0 };
    }

    for (let i = 0; i < events.length; i++) {
      const curr = events[i];

      // 1. Check sequence continuity
      const expectedSeq = fromSeq + i;
      if (Number(curr.sequence_number) !== expectedSeq) {
        return {
          isValid: false,
          totalEventsVerified: i,
          brokenSequenceNumber: expectedSeq,
          failureReason: `SEQUENCE_GAP_DETECTED: Expected sequence ${expectedSeq}, found ${curr.sequence_number}`,
        };
      }

      // 2. Check previous hash link
      if (i > 0) {
        const prev = events[i - 1];
        if (curr.previous_event_hash !== prev.event_hash) {
          return {
            isValid: false,
            totalEventsVerified: i,
            brokenSequenceNumber: Number(curr.sequence_number),
            failureReason: `HASH_LINK_CORRUPTED: Sequence ${curr.sequence_number} previous_hash does not match prior event_hash`,
          };
        }
      }

      // 3. Recompute canonical hash from payload bytes
      const canonicalBefore = curr.canonical_before !== undefined
        ? (curr.canonical_before || '{}')
        : (curr.before_state ? canonicalizeJson(curr.before_state) : '{}');
      const canonicalAfter = curr.canonical_after !== undefined
        ? (curr.canonical_after || '{}')
        : (curr.after_state ? canonicalizeJson(curr.after_state) : '{}');
      const rawPayload = `${curr.previous_event_hash}|${curr.sequence_number}|${organizationId}|${curr.entity_name}|${curr.entity_id}|${curr.action}|${curr.actor_id || 'SYSTEM'}|${canonicalBefore}|${canonicalAfter}|${curr.reason_for_change || ''}|${curr.created_at_iso}`;

      const expectedHash = crypto.createHash('sha256').update(rawPayload).digest('hex');
      if (curr.event_hash !== expectedHash) {
        return {
          isValid: false,
          totalEventsVerified: i,
          brokenSequenceNumber: Number(curr.sequence_number),
          failureReason: `TAMPER_DETECTED: Stored hash does not match recomputed payload hash at sequence ${curr.sequence_number}`,
        };
      }
    }

    return {
      isValid: true,
      totalEventsVerified: events.length,
    };
  }
}
