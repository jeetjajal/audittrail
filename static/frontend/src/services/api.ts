/**
 * AuditTrail AI — Frontend API Client
 * Interfaces with Atlassian Forge Bridge and the Fastify Remote Backend
 */

import {
  Incident,
  Investigation,
  CAPA,
  ControlledDocument,
  ApprovalStep,
  AuditEvent,
  AiSuggestion,
} from '../types';

const API_BASE = process.env.REACT_APP_API_URL || '/api/v1';

export class ApiClient {
  private static async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.warn(`API call to ${url} failed: ${(err as Error).message}`);
      throw err;
    }
  }

  // Health
  public static async getHealth() {
    return this.request<{ status: string; uptime: number; version: string }>('/health');
  }

  public static async getDatabaseHealth() {
    return this.request<{
      status: string;
      database: string;
      databaseName: string;
      applicationRole: string;
      totalTables: number;
      rlsEnforcedTables: number;
      latencyMs: number;
    }>('/health/database');
  }

  // Incidents
  public static async getIncidents(params?: { status?: string; severity?: string; limit?: string; offset?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ items: Incident[]; total: number }>(`/incidents${query ? '?' + query : ''}`);
  }

  public static async getIncident(id: string) {
    return this.request<Incident>(`/incidents/${id}`);
  }

  public static async createIncident(data: any) {
    return this.request<{ incidentId: string; incidentNumber: string; status: string }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async assignIncident(id: string, assignedToUserId: string, notes?: string) {
    return this.request(`/incidents/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignedToUserId, notes }),
    });
  }

  public static async transitionIncident(id: string, toStatus: string, reasonForChange: string) {
    return this.request(`/incidents/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStatus, reasonForChange }),
    });
  }

  // Investigations & RCA
  public static async startInvestigation(incidentId: string, data: any) {
    return this.request<Investigation>(`/incidents/${incidentId}/investigations`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getInvestigation(id: string) {
    return this.request<Investigation>(`/investigations/${id}`);
  }

  public static async addRootCause(investigationId: string, data: any) {
    return this.request(`/investigations/${investigationId}/root-causes`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async addFiveWhys(investigationId: string, data: any) {
    return this.request(`/investigations/${investigationId}/five-whys`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async addFishbone(investigationId: string, data: any) {
    return this.request(`/investigations/${investigationId}/fishbone`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // CAPA
  public static async getCapas(params?: { status?: string; riskLevel?: string; limit?: string; offset?: string }) {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<{ items: CAPA[]; total: number }>(`/capas${query ? '?' + query : ''}`);
  }

  public static async getCapa(id: string) {
    return this.request<CAPA>(`/capas/${id}`);
  }

  public static async createCapa(data: any) {
    return this.request<{ id: string; capa_number: string; status: string }>('/capas', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async addCapaAction(capaId: string, data: any) {
    return this.request(`/capas/${capaId}/actions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async closeCapa(capaId: string) {
    return this.request(`/capas/${capaId}/close`, {
      method: 'POST',
    });
  }

  // Documents & Evidence
  public static async getDocument(id: string) {
    return this.request<ControlledDocument>(`/documents/${id}`);
  }

  public static async createDocument(data: any) {
    return this.request<ControlledDocument>('/documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public static async getIncidentEvidence(incidentId: string) {
    return this.request<{ items: any[] }>(`/incidents/${incidentId}/evidence`);
  }

  // Approvals & Signatures
  public static async getPendingApprovals() {
    return this.request<{ items: ApprovalStep[]; total: number }>('/approvals/pending');
  }

  public static async approveStep(stepId: string, meaningOfSignature: string, notes?: string) {
    return this.request(`/approvals/${stepId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ meaningOfSignature, notes, reauthProofToken: 'mfa-verified-token' }),
    });
  }

  public static async rejectStep(stepId: string, rejectionReason: string) {
    return this.request(`/approvals/${stepId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ rejectionReason }),
    });
  }

  // AI Decision Support
  public static async analyzeIncident(incidentId: string) {
    return this.request<{
      analysisId: string;
      suggestionId: string;
      modelName: string;
      modelConfidence: number;
      generatedAt?: string;
      analysis: any;
      suggestion: AiSuggestion;
    }>('/ai/incident-analysis', {
      method: 'POST',
      body: JSON.stringify({ incidentId }),
    });
  }

  public static async getHistoricalMatches(incidentId: string) {
    return this.request<{ matches: any[] }>('/ai/historical-matching', {
      method: 'POST',
      body: JSON.stringify({ incidentId }),
    });
  }

  public static async submitAiFeedback(suggestionId: string, disposition: string, feedback?: any) {
    return this.request('/ai/feedback', {
      method: 'POST',
      body: JSON.stringify({ suggestionId, disposition, ...feedback }),
    });
  }

  // Audit
  public static async getAuditEvents(limit: number = 50, offset: number = 0) {
    return this.request<{ events: AuditEvent[]; total: number }>(`/audit/events?limit=${limit}&offset=${offset}`);
  }

  public static async verifyAuditLedger(fromSeq: number = 1, toSeq: number = 1000) {
    return this.request<{
      isValid: boolean;
      totalEventsVerified: number;
      brokenSequenceNumber?: number;
      failureReason?: string;
    }>(`/audit/verify?fromSeq=${fromSeq}&toSeq=${toSeq}`);
  }
}
