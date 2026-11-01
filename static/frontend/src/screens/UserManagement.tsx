import React from 'react';
import { StatusBadge } from '../components/Common';

export const UserManagement: React.FC = () => {
  const users = [
    {
      id: 'u-01',
      name: 'Dr. Eleanor Mitchell',
      email: 'eleanor.mitchell@apexcardiac.com',
      title: 'Director of Quality Assurance',
      role: 'Quality Assurance Lead',
      atlassianId: '557058:eleanor-mitchell-apex',
      status: 'ACTIVE',
      permissions: ['incident:create', 'investigation:lead', 'capa:approve', 'esignature:execute'],
    },
    {
      id: 'u-02',
      name: 'Marcus Vance',
      email: 'marcus.vance@apexcardiac.com',
      title: 'Senior Manufacturing Quality Engineer',
      role: 'Manufacturing Quality Engineer',
      atlassianId: '557058:marcus-vance-apex',
      status: 'ACTIVE',
      permissions: ['incident:create', 'investigation:lead', 'capa:action_complete'],
    },
    {
      id: 'u-03',
      name: 'Sarah Chen, RAC',
      email: 'sarah.chen@apexcardiac.com',
      title: 'Manager of Regulatory Affairs',
      role: 'Regulatory Affairs Manager',
      atlassianId: '557058:sarah-chen-apex',
      status: 'ACTIVE',
      permissions: ['incident:mdr_triage', 'esignature:execute', 'audit:read'],
    },
    {
      id: 'u-04',
      name: 'Arthur Pendelton',
      email: 'arthur.pendelton@apexcardiac.com',
      title: 'Lead Internal Auditor',
      role: 'Internal Quality Auditor',
      atlassianId: '557058:arthur-pendelton-apex',
      status: 'ACTIVE',
      permissions: ['audit:read', 'reports:compile', 'incident:view'],
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#172B4D', margin: '0 0 6px 0' }}>
            User Directory & Role-Based Access Control (RBAC)
          </h1>
          <div style={{ fontSize: '13px', color: '#6B778C' }}>
            Authorized clinical personnel directory with 21 CFR Part 11 electronic signature rights.
          </div>
        </div>
      </div>

      {/* User Table */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: '6px', border: '1px solid #DFE1E6', overflow: 'hidden', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4F5F7', borderBottom: '2px solid #EBECF0', textAlign: 'left', color: '#6B778C' }}>
              <th style={{ padding: '10px 16px' }}>Full Name</th>
              <th style={{ padding: '10px 16px' }}>Email</th>
              <th style={{ padding: '10px 16px' }}>Job Title</th>
              <th style={{ padding: '10px 16px' }}>Assigned RBAC Role</th>
              <th style={{ padding: '10px 16px' }}>Status</th>
              <th style={{ padding: '10px 16px' }}>Part 11 E-Signature Rights</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderBottom: '1px solid #EBECF0', height: '48px' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#0052CC' }}>{u.name}</td>
                <td style={{ padding: '10px 16px', color: '#172B4D' }}>{u.email}</td>
                <td style={{ padding: '10px 16px', color: '#505F79' }}>{u.title}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#DEEBFF', color: '#0747A6', padding: '2px 8px', borderRadius: '3px' }}>
                    {u.role}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <StatusBadge type="status" value={u.status} />
                </td>
                <td style={{ padding: '10px 16px' }}>
                  {u.permissions.includes('esignature:execute') ? (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#006644', backgroundColor: '#E3FCEF', padding: '2px 6px', borderRadius: '3px' }}>
                      AUTHORIZED SIGNER
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#8993A4' }}>Reviewer Only</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RBAC Security Policy Callout */}
      <div style={{ backgroundColor: '#FAFBFC', border: '1px solid #DFE1E6', borderRadius: '6px', padding: '18px' }}>
        <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 700, color: '#172B4D' }}>
          Segregation of Duties & Regulatory Access Controls
        </h4>
        <p style={{ margin: 0, fontSize: '12px', color: '#505F79', lineHeight: '1.5' }}>
          Pursuant to ISO 13485:2016 § 5.5.1 and FDA 21 CFR § 820.20, responsibilities and authorities are strictly segregated.
          Personnel performing quality non-conformance investigations cannot independently sign off on their own CAPA effectiveness
          evaluations. All user roles and permission grants are enforced via PostgreSQL composite row-level security.
        </p>
      </div>
    </div>
  );
};
