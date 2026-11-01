import { PoolClient } from 'pg';
import { AuditService } from './audit-service';

export interface CreateCapaActionInput {
  organizationId: string;
  capaId: string;
  actionNumber: number;
  actionType: 'PROCESS_CHANGE' | 'DMR_REVISION' | 'RETRAINING' | 'SUPPLIER_SCAR' | 'DEVICE_RECALL' | 'DESIGN_CHANGE' | 'SOFTWARE_PATCH';
  description: string;
  assigneeId: string;
  dueDate: string;
  dependsOnActionIds?: string[];
}

export class CapaService {
  /**
   * Adds an action to a CAPA and enforces DAG dependency validity (no cycles)
   * Resolves Defect AUD-09
   */
  public static async addCapaAction(
    client: PoolClient,
    input: CreateCapaActionInput,
    actorId: string,
    correlationId: string
  ): Promise<string> {
    // 1. Insert action
    const insertActionSql = `
      INSERT INTO capa_actions (
        organization_id, capa_id, action_number, action_type, description, assignee_id, due_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
      RETURNING id;
    `;
    const actionRes = await client.query(insertActionSql, [
      input.organizationId,
      input.capaId,
      input.actionNumber,
      input.actionType,
      input.description,
      input.assigneeId,
      input.dueDate,
    ]);
    const actionId = actionRes.rows[0].id;

    // 2. Insert dependencies (trigger fn_check_capa_dependency_cycle validates DAG)
    if (input.dependsOnActionIds && input.dependsOnActionIds.length > 0) {
      for (const prereqId of input.dependsOnActionIds) {
        await client.query(
          `INSERT INTO capa_action_dependencies (organization_id, action_id, depends_on_action_id)
           VALUES ($1, $2, $3);`,
          [input.organizationId, actionId, prereqId]
        );
      }
    }

    // 3. Atomically record audit event
    await AuditService.recordAuditEvent(client, {
      organizationId: input.organizationId,
      entityName: 'capa_actions',
      entityId: actionId,
      action: 'INSERT',
      actorId,
      correlationId,
      reasonForChange: `Added CAPA action ${input.actionNumber} (${input.actionType})`,
      afterState: { ...input, id: actionId },
    });

    return actionId;
  }

  /**
   * Validates whether a CAPA can be advanced to CLOSED
   * All actions must be VERIFIED, and effectiveness review must be verified TRUE.
   */
  public static async validateCapaClosure(client: PoolClient, organizationId: string, capaId: string): Promise<void> {
    // Check pending/unverified actions
    const pendingActions = await client.query(
      `SELECT id, action_number, status FROM capa_actions
       WHERE organization_id = $1 AND capa_id = $2 AND status != 'VERIFIED';`,
      [organizationId, capaId]
    );

    if (pendingActions.rows.length > 0) {
      const numbers = pendingActions.rows.map((r) => r.action_number).join(', ');
      throw new Error(`CAPA_CLOSURE_PREVENTED: Actions [${numbers}] are not yet in VERIFIED status`);
    }

    // Check effectiveness review
    const effReview = await client.query(
      `SELECT is_effective, evaluated_at FROM capa_effectiveness_reviews
       WHERE organization_id = $1 AND capa_id = $2
       ORDER BY scheduled_date DESC LIMIT 1;`,
      [organizationId, capaId]
    );

    if (effReview.rows.length === 0 || !effReview.rows[0].evaluated_at) {
      throw new Error('CAPA_CLOSURE_PREVENTED: Formal effectiveness evaluation has not been conducted');
    }

    if (effReview.rows[0].is_effective !== true) {
      throw new Error('CAPA_CLOSURE_PREVENTED: Effectiveness review determined CAPA was ineffective. CAPA must be reopened.');
    }
  }
}
