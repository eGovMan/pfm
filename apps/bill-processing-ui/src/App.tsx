import React, { useState } from 'react';
import { useAuth, hasRole } from './auth';
import { urls } from './config';
import {
  issueWorkProof,
  issueVendorProof,
  evaluate,
  reserveBudget,
  postDecision,
  getAuditTimeline,
  submitPayment,
  postAppeal,
  postOverride,
} from './api';

const RULEBOOK_ID = 'vendor-payment';
const RULEBOOK_VERSION = 'v0.1';
const WORKS_ISSUER = 'did:web:works.demo.gov';
const VENDOR_ISSUER = 'did:web:vendor.demo.gov';

type Step = 'form' | 'proofs' | 'evaluate' | 'result';

export default function App() {
  const auth = useAuth();
  const [step, setStep] = useState<Step>('form');
  const [caseId] = useState(() => 'case-' + Math.random().toString(36).slice(2, 10));
  const [form, setForm] = useState({
    workId: 'work-1',
    milestoneId: 'm1',
    vendorId: 'v1',
    amount: 50000,
    budgetHead: 'head-001',
    completionDate: new Date().toISOString().slice(0, 10),
    bankValidated: true,
  });
  const [proofRefs, setProofRefs] = useState<Array<{ proofId: string; proofType: string; issuerId: string }>>([]);
  const [evalResult, setEvalResult] = useState<{
    decision: string;
    reasons: Array<{ code: string; message: string; severity: string; overrideAllowed: boolean }>;
    proofChecks: unknown[];
    evaluatedAt: string;
  } | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [appealStatus, setAppealStatus] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!auth.ready) return null;
  const { keycloak, token } = auth;
  const canOverride = hasRole(keycloak, 'redressal_authority');

  const handleCreateCase = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStep('proofs');
  };

  const handleFetchProofs = async () => {
    setLoading(true);
    setError(null);
    try {
      const workRes = await issueWorkProof(urls.worksProof, {
        workId: form.workId,
        milestoneId: form.milestoneId,
        completionDate: form.completionDate,
      });
      if (!workRes.ok || !workRes.data) {
        setError(workRes.error?.message ?? 'Work proof failed');
        return;
      }
      const workProof = workRes.data as { proofId: string };
      const vendorRes = await issueVendorProof(urls.vendorProof, {
        canonicalVendorId: form.vendorId,
        bankValidated: form.bankValidated,
        blacklisted: false,
      });
      if (!vendorRes.ok || !vendorRes.data) {
        setError(vendorRes.error?.message ?? 'Vendor proof failed');
        return;
      }
      const vendorProof = vendorRes.data as { proofId: string };
      setProofRefs([
        { proofId: workProof.proofId, proofType: 'WorkCompletionProof', issuerId: WORKS_ISSUER },
        { proofId: vendorProof.proofId, proofType: 'VendorEligibilityProof', issuerId: VENDOR_ISSUER },
      ]);
      setStep('evaluate');
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    setLoading(true);
    setError(null);
    setEvalResult(null);
    try {
      const res = await evaluate(urls.checks, {
        caseId,
        vendorId: form.vendorId,
        workId: form.workId,
        milestoneId: form.milestoneId,
        amount: form.amount,
        budgetHead: form.budgetHead,
        proofRefs,
        rulebookId: RULEBOOK_ID,
        rulebookVersion: RULEBOOK_VERSION,
      });
      if (!res.ok) {
        setError(res.error?.message ?? 'Evaluate failed');
        return;
      }
      const data = res.data as {
        decision: string;
        reasons: Array<{ code: string; message: string; severity: string; overrideAllowed: boolean }>;
        proofChecks: unknown[];
        evaluatedAt: string;
      };
      setEvalResult(data);
      setStep('result');
    } finally {
      setLoading(false);
    }
  };

  const handleReserveAndSubmit = async () => {
    if (!evalResult || evalResult.decision !== 'APPROVE') return;
    setLoading(true);
    setError(null);
    setSubmitStatus(null);
    try {
      const reserveRes = await reserveBudget(urls.budget, {
        caseId,
        budgetHead: form.budgetHead,
        amount: form.amount,
      });
      if (!reserveRes.ok || !reserveRes.data) {
        setError((reserveRes.error?.message ?? 'Reserve failed') + (reserveRes.error?.code ? ` (${reserveRes.error.code})` : ''));
        return;
      }
      const rid = (reserveRes.data as { reservationId: string }).reservationId;

      const postDecRes = await postDecision(urls.audit, {
        caseId,
        rulebookId: RULEBOOK_ID,
        rulebookVersion: RULEBOOK_VERSION,
        evaluatedAt: evalResult.evaluatedAt,
        decision: evalResult.decision,
        reasons: evalResult.reasons,
        proofRefs: proofRefs.map((p) => ({ proofType: p.proofType, proofId: p.proofId })),
        proofChecks: evalResult.proofChecks,
        reservationId: rid,
      });
      if (!postDecRes.ok) {
        setError(postDecRes.error?.message ?? 'Post decision failed');
        return;
      }

      const timelineRes = await getAuditTimeline(urls.audit, caseId);
      if (!timelineRes.ok || !timelineRes.data) {
        setError('Could not get audit timeline for decisionHash');
        return;
      }
      const timeline = timelineRes.data as { timeline?: Array<{ type: string; data: { decisionHash?: string } }> };
      const lastDecision = [...(timeline.timeline ?? [])].reverse().find((t) => t.type === 'decision');
      const decisionHash = lastDecision?.data?.decisionHash;
      if (!decisionHash) {
        setError('Decision hash not found in audit');
        return;
      }

      const submitRes = await submitPayment(urls.connector, {
        caseId,
        amount: form.amount,
        budgetHead: form.budgetHead,
        vendorId: form.vendorId,
        workId: form.workId,
        milestoneId: form.milestoneId,
        rulebookId: RULEBOOK_ID,
        rulebookVersion: RULEBOOK_VERSION,
        proofRefs: proofRefs.map((p) => ({ proofType: p.proofType, proofId: p.proofId })),
        reservationId: rid,
        decision: 'APPROVE',
        decisionHash,
        issuedAt: evalResult.evaluatedAt,
      });
      if (submitRes.ok) {
        setSubmitStatus('Payment submitted successfully. Check audit timeline.');
      } else {
        setError(submitRes.error?.message ?? submitRes.error?.code ?? 'Submit payment failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppeal = async () => {
    setLoading(true);
    setAppealStatus(null);
    setError(null);
    try {
      const res = await postAppeal(urls.exceptions, {
        caseId,
        reason: 'Appeal from Bill UI (demo)',
        raisedBy: (keycloak.tokenParsed as { preferred_username?: string })?.preferred_username ?? 'user',
      });
      if (res.ok) setAppealStatus('Appeal recorded.');
      else setError(res.error?.message ?? 'Appeal failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!canOverride || !evalResult?.reasons?.length) return;
    const allowedCodes = evalResult.reasons.filter((r) => r.overrideAllowed).map((r) => r.code).filter(Boolean);
    if (allowedCodes.length === 0) return;
    setLoading(true);
    setOverrideStatus(null);
    setError(null);
    const reasonCodes = allowedCodes;
    try {
      const res = await postOverride(urls.exceptions, token, {
        caseId,
        reasonCodesOverridden: reasonCodes,
        justification: 'Override from Bill UI (demo)',
      });
      if (res.ok) setOverrideStatus('Override recorded. Re-evaluate or proceed as needed.');
      else setError(res.error?.message ?? res.error?.code ?? 'Override failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => keycloak.logout();

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Bill Processing</h1>
        <div>
          <span style={{ marginRight: '1rem' }}>
            {(keycloak.tokenParsed as { preferred_username?: string })?.preferred_username ?? 'User'}
          </span>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>

      <p style={{ color: '#666', marginBottom: '1rem' }}>Case ID: {caseId}</p>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee', border: '1px solid #c00', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {step === 'form' && (
        <form onSubmit={handleCreateCase}>
          <h2>Create case</h2>
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1rem' }}>
            <label>Work ID <input value={form.workId} onChange={(e) => setForm((f) => ({ ...f, workId: e.target.value }))} /></label>
            <label>Milestone ID <input value={form.milestoneId} onChange={(e) => setForm((f) => ({ ...f, milestoneId: e.target.value }))} /></label>
            <label>Vendor ID <input value={form.vendorId} onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))} /></label>
            <label>Amount <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value) }))} /></label>
            <label>Budget head <input value={form.budgetHead} onChange={(e) => setForm((f) => ({ ...f, budgetHead: e.target.value }))} /></label>
            <label>Completion date <input type="date" value={form.completionDate} onChange={(e) => setForm((f) => ({ ...f, completionDate: e.target.value }))} /></label>
            <label><input type="checkbox" checked={form.bankValidated} onChange={(e) => setForm((f) => ({ ...f, bankValidated: e.target.checked }))} /> Bank validated</label>
          </div>
          <button type="submit">Next: Fetch proofs</button>
        </form>
      )}

      {step === 'proofs' && (
        <>
          <h2>Proofs</h2>
          <p>Click to issue work and vendor proofs for this case.</p>
          <button type="button" onClick={handleFetchProofs} disabled={loading}>
            {loading ? 'Issuing…' : 'Issue proofs'}
          </button>
          {proofRefs.length > 0 && (
            <p style={{ marginTop: '1rem' }}>Proofs: {proofRefs.map((p) => p.proofType + ' ' + p.proofId).join(', ')}</p>
          )}
        </>
      )}

      {step === 'evaluate' && proofRefs.length > 0 && (
        <>
          <h2>Evaluate</h2>
          <button type="button" onClick={handleEvaluate} disabled={loading}>
            {loading ? 'Evaluating…' : 'Evaluate'}
          </button>
        </>
      )}

      {step === 'result' && evalResult && (
        <>
          <h2>Result</h2>
          <p><strong>Decision:</strong> {evalResult.decision}</p>
          {evalResult.reasons.length > 0 && (
            <ul>
              {evalResult.reasons.map((r, i) => (
                <li key={i}>{r.code}: {r.message} (override allowed: {String(r.overrideAllowed)})</li>
              ))}
            </ul>
          )}
          {evalResult.decision === 'APPROVE' && (
            <div>
              <button type="button" onClick={handleReserveAndSubmit} disabled={loading}>
                {loading ? 'Submitting…' : 'Reserve budget & submit payment'}
              </button>
              {submitStatus && <p style={{ color: 'green' }}>{submitStatus}</p>}
            </div>
          )}
          {(evalResult.decision === 'HOLD' || evalResult.decision === 'DENY') && (
            <div>
              <button type="button" onClick={handleAppeal} disabled={loading}>
                Appeal
              </button>
              {appealStatus && <p style={{ color: 'green' }}>{appealStatus}</p>}
              {canOverride && evalResult.reasons.some((r) => r.overrideAllowed) && (
                <>
                  <button type="button" onClick={handleOverride} disabled={loading} style={{ marginLeft: '0.5rem' }}>
                    Override
                  </button>
                  {overrideStatus && <p style={{ color: 'green' }}>{overrideStatus}</p>}
                </>
              )}
            </div>
          )}
        </>
      )}

      {loading && <p style={{ marginTop: '1rem' }}>Loading…</p>}
    </div>
  );
}
