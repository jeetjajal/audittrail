import React from 'react';

export type ScreenId =
  | 'dashboard'
  | 'incidents'
  | 'incident-details'
  | 'investigation'
  | 'root-cause'
  | 'ai-assistant'
  | 'capas'
  | 'capa-actions'
  | 'evidence'
  | 'approvals'
  | 'audit-ledger'
  | 'reports'
  | 'settings'
  | 'users';

interface LayoutProps {
  currentScreen: ScreenId;
  onSelectScreen: (screen: ScreenId) => void;
  selectedIncidentId?: string;
  selectedCapaId?: string;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentScreen,
  onSelectScreen,
  selectedIncidentId,
  selectedCapaId,
  children,
}) => {
  const navSections = [
    {
      title: 'Quality Operations',
      items: [
        { id: 'dashboard' as ScreenId, label: 'Executive Dashboard', icon: '📊' },
        { id: 'incidents' as ScreenId, label: 'Incident Management', icon: '🚨' },
        { id: 'incident-details' as ScreenId, label: 'Incident Details', icon: '🔍', disabled: !selectedIncidentId },
        { id: 'investigation' as ScreenId, label: 'Investigation Workspace', icon: '🔬' },
        { id: 'root-cause' as ScreenId, label: 'Root Cause Analysis', icon: '🌲' },
        { id: 'ai-assistant' as ScreenId, label: 'AI Investigation Assistant', icon: '✨' },
      ],
    },
    {
      title: 'Corrective Actions & Evidence',
      items: [
        { id: 'capas' as ScreenId, label: 'CAPA Management', icon: '🛡️' },
        { id: 'capa-actions' as ScreenId, label: 'CAPA Action Details', icon: '⚙️', disabled: !selectedCapaId },
        { id: 'evidence' as ScreenId, label: 'Evidence & Document Center', icon: '📁' },
        { id: 'approvals' as ScreenId, label: 'Approval Center (Part 11)', icon: '✍️' },
      ],
    },
    {
      title: 'Compliance & Audit',
      items: [
        { id: 'audit-ledger' as ScreenId, label: 'Tamper-Evident Audit Ledger', icon: '⛓️' },
        { id: 'reports' as ScreenId, label: 'Reports & Analytics', icon: '📑' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { id: 'settings' as ScreenId, label: 'Organization Settings', icon: '🏢' },
        { id: 'users' as ScreenId, label: 'User & Role Management', icon: '👥' },
      ],
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#FAFBFC', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}>
      {/* Top Header */}
      <header
        style={{
          height: '56px',
          backgroundColor: '#0052CC',
          color: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚡</span>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '0.2px' }}>AuditTrail AI</span>
          </div>
          <span style={{ fontSize: '11px', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px' }}>
            v2.1.0 eQMS (FDA QMSR 2026)
          </span>
          <span style={{ fontSize: '13px', color: '#DEEBFF', borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '16px' }}>
            Apex Cardiac Technologies (FDA Reg #3004829101)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', backgroundColor: '#0747A6', padding: '4px 10px', borderRadius: '4px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#36B37E' }}></span>
            <span>PostgreSQL 18.6 • RLS Active</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#FFAB00', color: '#172B4D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              EM
            </span>
            <span>Dr. Eleanor Mitchell (QA Lead)</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <nav
          style={{
            width: '260px',
            backgroundColor: '#F4F5F7',
            borderRight: '1px solid #DFE1E6',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '16px 12px' }}>
            {navSections.map((section, sIdx) => (
              <div key={sIdx} style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#6B778C',
                    textTransform: 'uppercase',
                    padding: '0 8px 6px 8px',
                    letterSpacing: '0.5px',
                  }}
                >
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const isActive = currentScreen === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => !item.disabled && onSelectScreen(item.id)}
                      disabled={item.disabled}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        cursor: item.disabled ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive ? '#DEEBFF' : 'transparent',
                        color: item.disabled ? '#A5ADBA' : isActive ? '#0052CC' : '#172B4D',
                        marginBottom: '2px',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      <span style={{ fontSize: '16px' }}>{item.icon}</span>
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 32px',
            backgroundColor: '#FAFBFC',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
};
