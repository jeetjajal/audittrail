import React, { useState } from 'react';
import { Layout, ScreenId } from './components/Layout';
import { ExecutiveDashboard } from './screens/ExecutiveDashboard';
import { IncidentManagement } from './screens/IncidentManagement';
import { IncidentDetails } from './screens/IncidentDetails';
import { InvestigationWorkspace } from './screens/InvestigationWorkspace';
import { RootCauseAnalysis } from './screens/RootCauseAnalysis';
import { AiInvestigationAssistant } from './screens/AiInvestigationAssistant';
import { CapaManagement } from './screens/CapaManagement';
import { CapaActionDetails } from './screens/CapaActionDetails';
import { EvidenceCenter } from './screens/EvidenceCenter';
import { ApprovalCenter } from './screens/ApprovalCenter';
import { AuditLedger } from './screens/AuditLedger';
import { ReportsAnalytics } from './screens/ReportsAnalytics';
import { OrganizationSettings } from './screens/OrganizationSettings';
import { UserManagement } from './screens/UserManagement';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('dashboard');
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('c1000000-0000-0000-0000-000000000001');
  const [selectedCapaId, setSelectedCapaId] = useState<string>('c2000000-0000-0000-0000-000000000001');

  function handleNavigate(screen: ScreenId, entityId?: string) {
    if (entityId) {
      if (screen === 'incident-details' || screen === 'investigation' || screen === 'ai-assistant') {
        setSelectedIncidentId(entityId);
      } else if (screen === 'capa-actions') {
        setSelectedCapaId(entityId);
      }
    }
    setCurrentScreen(screen);
  }

  return (
    <Layout
      currentScreen={currentScreen}
      onSelectScreen={setCurrentScreen}
      selectedIncidentId={selectedIncidentId}
      selectedCapaId={selectedCapaId}
    >
      {currentScreen === 'dashboard' && <ExecutiveDashboard onNavigate={handleNavigate} />}
      {currentScreen === 'incidents' && <IncidentManagement onNavigate={handleNavigate} />}
      {currentScreen === 'incident-details' && (
        <IncidentDetails incidentId={selectedIncidentId} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'investigation' && (
        <InvestigationWorkspace incidentId={selectedIncidentId} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'root-cause' && (
        <RootCauseAnalysis investigationId={selectedIncidentId} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'ai-assistant' && (
        <AiInvestigationAssistant incidentId={selectedIncidentId} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'capas' && <CapaManagement onNavigate={handleNavigate} />}
      {currentScreen === 'capa-actions' && (
        <CapaActionDetails capaId={selectedCapaId} onNavigate={handleNavigate} />
      )}
      {currentScreen === 'evidence' && <EvidenceCenter onNavigate={handleNavigate} />}
      {currentScreen === 'approvals' && <ApprovalCenter onNavigate={handleNavigate} />}
      {currentScreen === 'audit-ledger' && <AuditLedger />}
      {currentScreen === 'reports' && <ReportsAnalytics onNavigate={handleNavigate} />}
      {currentScreen === 'settings' && <OrganizationSettings />}
      {currentScreen === 'users' && <UserManagement />}
    </Layout>
  );
};
