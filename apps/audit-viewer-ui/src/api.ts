import { auditBaseUrl, exceptionsBaseUrl } from './config';

export async function getTimeline(caseId: string): Promise<{ ok: boolean; data?: { caseId: string; timeline: TimelineItem[] }; error?: string }> {
  const res = await fetch(`${auditBaseUrl}/v1/audit/cases/${encodeURIComponent(caseId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } })?.error?.message ?? res.statusText };
  }
  const data = await res.json();
  return { ok: true, data };
}

export async function getValidate(caseId: string): Promise<{ ok: boolean; data?: { caseId: string; integrity: string; results: Array<{ index: number; type: string; valid: boolean }> }; error?: string }> {
  const res = await fetch(`${auditBaseUrl}/v1/audit/cases/${encodeURIComponent(caseId)}/validate`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } })?.error?.message ?? res.statusText };
  }
  const data = await res.json();
  return { ok: true, data };
}

export async function getExceptions(caseId: string): Promise<{ ok: boolean; data?: { appeals: unknown[]; overrides: unknown[] }; error?: string }> {
  const res = await fetch(`${exceptionsBaseUrl}/v1/exceptions/cases/${encodeURIComponent(caseId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, error: (err as { error?: { message?: string } })?.error?.message ?? res.statusText };
  }
  const data = await res.json();
  return { ok: true, data };
}

export type TimelineItem =
  | { type: 'decision'; data: DecisionData }
  | { type: 'event'; data: EventData };

export interface DecisionData {
  id: string;
  caseId: string;
  rulebookId: string;
  rulebookVersion: string;
  evaluatedAt: string;
  decision: string;
  reasons: Array<{ code: string; message?: string; severity?: string; overrideAllowed?: boolean }>;
  proofRefs: unknown[];
  proofChecks: unknown[];
  reservationId?: string;
  decisionHash?: string;
  previousHash?: string;
  recordHash?: string;
}

export interface EventData {
  id: string;
  caseId: string;
  source: string;
  eventType: string;
  eventTime: string;
  refs: Record<string, unknown>;
  previousHash?: string;
  eventHash?: string;
}
