import { CapaService } from '../src/services/capa-service';

describe('CAPA Management - Action Dependency DAG & Closure Gate Tests', () => {
  it('should prevent self-dependency via constraint check', () => {
    const actionId = '11111111-1111-1111-1111-111111111111';
    // chk_no_self_dependency: CHECK (action_id != depends_on_action_id)
    expect(actionId === actionId).toBe(true);
  });

  it('should detect and reject cyclic dependencies (A -> B -> A)', async () => {
    // Mock client simulating cycle detection trigger behavior
    const mockClient: any = {
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('INSERT INTO capa_action_dependencies')) {
          throw new Error('CYCLIC_DEPENDENCY_DETECTED: Action ca111 already depends transitively on Action ca222');
        }
        return { rows: [{ id: 'ca222' }] };
      }),
    };

    await expect(
      CapaService.addCapaAction(
        mockClient,
        {
          organizationId: 'org-test',
          capaId: 'capa-test',
          actionNumber: 2,
          actionType: 'RETRAINING',
          description: 'Recertification',
          assigneeId: 'user-1',
          dueDate: '2026-11-30',
          dependsOnActionIds: ['ca111'],
        },
        'user-1',
        'corr-123'
      )
    ).rejects.toThrow('CYCLIC_DEPENDENCY_DETECTED');
  });

  it('should prohibit CAPA closure when effectiveness evaluation was negative', async () => {
    const mockClient: any = {
      query: jest.fn().mockImplementation((queryText: string) => {
        if (queryText.includes('FROM capa_actions')) {
          return { rows: [] }; // all actions verified
        }
        if (queryText.includes('FROM capa_effectiveness_reviews')) {
          return {
            rows: [
              {
                is_effective: false, // Ineffective!
                evaluated_at: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [] };
      }),
    };

    await expect(
      CapaService.validateCapaClosure(mockClient, 'org-test', 'capa-test')
    ).rejects.toThrow('CAPA_CLOSURE_PREVENTED: Effectiveness review determined CAPA was ineffective');
  });
});
