import { urls } from './config';

async function api(
  base: string,
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {}
): Promise<{ ok: boolean; data?: unknown; error?: { code: string; message: string }; status: number }> {
  const { method = 'GET', body, token } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data?.error ?? { code: 'UNKNOWN', message: res.statusText }, status: res.status };
  }
  return { ok: true, data, status: res.status };
}

export async function issueWorkProof(
  worksBase: string,
  body: { workId: string; milestoneId: string; completionDate: string }
) {
  return api(worksBase, '/v1/proofs/issue', { method: 'POST', body });
}

export async function issueVendorProof(
  vendorBase: string,
  body: { canonicalVendorId: string; bankValidated: boolean; blacklisted: boolean }
) {
  return api(vendorBase, '/v1/proofs/issue', { method: 'POST', body });
}

export async function evaluate(
  checksBase: string,
  body: {
    caseId: string;
    vendorId: string;
    workId: string;
    milestoneId: string;
    amount: number;
    budgetHead: string;
    proofRefs: Array<{ proofId: string; proofType: string; issuerId: string }>;
    rulebookId: string;
    rulebookVersion: string;
  }
) {
  return api(checksBase, '/v1/checks/evaluate', { method: 'POST', body });
}

export async function reserveBudget(
  budgetBase: string,
  body: { caseId: string; budgetHead: string; amount: number; ttlSeconds?: number }
) {
  return api(budgetBase, '/v1/budget/reserve', { method: 'POST', body });
}

export async function postDecision(
  auditBase: string,
  body: {
    caseId: string;
    rulebookId: string;
    rulebookVersion: string;
    evaluatedAt: string;
    decision: string;
    reasons: unknown[];
    proofRefs: unknown[];
    proofChecks: unknown[];
    reservationId?: string;
  }
) {
  return api(auditBase, '/v1/audit/decisionRecords', { method: 'POST', body });
}

export async function getAuditTimeline(auditBase: string, caseId: string) {
  return api(auditBase, `/v1/audit/cases/${encodeURIComponent(caseId)}`);
}

export async function submitPayment(
  connectorBase: string,
  body: {
    caseId: string;
    amount: number;
    budgetHead: string;
    vendorId: string;
    workId: string;
    milestoneId: string;
    rulebookId: string;
    rulebookVersion: string;
    proofRefs: unknown[];
    reservationId: string;
    decision: string;
    decisionHash: string;
    issuedAt: string;
  }
) {
  return api(connectorBase, '/v1/connector/submitPayment', { method: 'POST', body });
}

export async function postAppeal(
  exceptionsBase: string,
  body: { caseId: string; reason: string; raisedBy: string }
) {
  return api(exceptionsBase, '/v1/exceptions/appeal', { method: 'POST', body });
}

export async function postOverride(
  exceptionsBase: string,
  token: string,
  body: { caseId: string; reasonCodesOverridden: string[]; justification: string }
) {
  return api(exceptionsBase, '/v1/exceptions/override', { method: 'POST', body, token });
}

export async function getExceptions(exceptionsBase: string, caseId: string) {
  return api(exceptionsBase, `/v1/exceptions/cases/${encodeURIComponent(caseId)}`);
}

export { urls };
