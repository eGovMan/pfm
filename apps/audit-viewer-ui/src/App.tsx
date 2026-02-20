import React, { useState, useMemo } from 'react';
import { getTimeline, getValidate, getExceptions, type TimelineItem, type DecisionData, type EventData } from './api';

export default function App() {
  const [caseId, setCaseId] = useState('');
  const [timeline, setTimeline] = useState<TimelineItem[] | null>(null);
  const [integrity, setIntegrity] = useState<string | null>(null);
  const [appeals, setAppeals] = useState<unknown[]>([]);
  const [overrides, setOverrides] = useState<unknown[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHashes, setShowHashes] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');

  const eventTypes = useMemo(() => {
    if (!timeline) return [];
    const set = new Set<string>();
    timeline.forEach((t) => {
      if (t.type === 'event') set.add((t.data as EventData).eventType);
    });
    return Array.from(set).sort();
  }, [timeline]);

  const filteredTimeline = useMemo(() => {
    if (!timeline) return [];
    if (!eventTypeFilter) return timeline;
    if (eventTypeFilter === '__decision__') return timeline.filter((t) => t.type === 'decision');
    return timeline.filter((t) => t.type === 'event' && (t.data as EventData).eventType === eventTypeFilter);
  }, [timeline, eventTypeFilter]);

  const handleSearch = async () => {
    const id = caseId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setTimeline(null);
    setIntegrity(null);
    setAppeals([]);
    setOverrides([]);
    try {
      const [timelineRes, validateRes, exceptionsRes] = await Promise.all([
        getTimeline(id),
        getValidate(id),
        getExceptions(id),
      ]);
      if (!timelineRes.ok) {
        setError(timelineRes.error ?? 'Failed to load timeline');
        return;
      }
      if (timelineRes.data) setTimeline(timelineRes.data.timeline);
      if (validateRes.ok && validateRes.data) setIntegrity(validateRes.data.integrity);
      if (exceptionsRes.ok && exceptionsRes.data) {
        setAppeals(exceptionsRes.data.appeals ?? []);
        setOverrides(exceptionsRes.data.overrides ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!timeline || !caseId.trim()) return;
    const payload = { caseId: caseId.trim(), timeline, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-timeline-${caseId.trim()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: 900 }}>
      <h1 style={{ marginTop: 0 }}>Audit Viewer</h1>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Case ID"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          style={{ padding: '0.5rem', minWidth: 200 }}
        />
        <button type="button" onClick={handleSearch} disabled={loading}>
          {loading ? 'Loading…' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', background: '#fee', border: '1px solid #c00', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {integrity !== null && (
        <div style={{ marginBottom: '1rem' }}>
          <strong>Integrity:</strong>{' '}
          <span style={{ color: integrity === 'OK' ? 'green' : 'red', fontWeight: 'bold' }}>{integrity}</span>
        </div>
      )}

      {timeline && timeline.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <label>
              <input type="checkbox" checked={showHashes} onChange={(e) => setShowHashes(e.target.checked)} />
              Advanced (show hashes)
            </label>
            <label>
              Filter event type:{' '}
              <select value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)}>
                <option value="">All</option>
                <option value="__decision__">Decisions only</option>
                {eventTypes.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={handleExport}>
              Export timeline JSON
            </button>
          </div>

          <section style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>Timeline</h2>
            <ol style={{ paddingLeft: '1.5rem' }}>
              {filteredTimeline.map((item, idx) => (
                <li key={idx} style={{ marginBottom: '1rem' }}>
                  {item.type === 'decision' ? (
                    <DecisionBlock data={item.data as DecisionData} showHashes={showHashes} />
                  ) : (
                    <EventBlock data={item.data as EventData} showHashes={showHashes} />
                  )}
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      {timeline && timeline.length === 0 && !error && <p>No timeline entries for this case.</p>}

      {appeals.length > 0 && (
        <section style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.1rem' }}>Appeals</h2>
          <pre style={{ background: '#f5f5f5', padding: '0.75rem', overflow: 'auto', fontSize: '0.9rem' }}>
            {JSON.stringify(appeals, null, 2)}
          </pre>
        </section>
      )}

      {overrides.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.1rem' }}>Overrides</h2>
          <pre style={{ background: '#f5f5f5', padding: '0.75rem', overflow: 'auto', fontSize: '0.9rem' }}>
            {JSON.stringify(overrides, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

function DecisionBlock({ data, showHashes }: { data: DecisionData; showHashes: boolean }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: '0.75rem', borderRadius: 4 }}>
      <strong>Decision</strong> — {data.decision} (rulebook: {data.rulebookId}@{data.rulebookVersion}, evaluated: {data.evaluatedAt})
      {data.reasons && data.reasons.length > 0 && (
        <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0 }}>
          {data.reasons.map((r, i) => (
            <li key={i}>{r.code}: {r.message ?? ''}</li>
          ))}
        </ul>
      )}
      {showHashes && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555', wordBreak: 'break-all' }}>
          previousHash: {data.previousHash ?? '—'}<br />
          decisionHash: {data.decisionHash ?? '—'}<br />
          recordHash: {data.recordHash ?? '—'}
        </div>
      )}
    </div>
  );
}

function EventBlock({ data, showHashes }: { data: EventData; showHashes: boolean }) {
  return (
    <div style={{ border: '1px solid #ccc', padding: '0.75rem', borderRadius: 4 }}>
      <strong>Event</strong> — {data.eventType} (source: {data.source}, {data.eventTime})
      {Object.keys(data.refs ?? {}).length > 0 && (
        <pre style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{JSON.stringify(data.refs, null, 2)}</pre>
      )}
      {showHashes && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#555', wordBreak: 'break-all' }}>
          previousHash: {data.previousHash ?? '—'}<br />
          eventHash: {data.eventHash ?? '—'}
        </div>
      )}
    </div>
  );
}
