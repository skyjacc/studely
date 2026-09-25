import { describe, it, expect } from 'vitest';
import { recordHistory, type CheckRow, type VerificationRow } from './history';

// The record's history is evidence: every row is something that actually
// happened and was written down. Nothing is synthesised from the projection on
// `offers` — last_check_result describes the newest check, and that check is
// already in link_checks, so reading it twice would invent a second event.

const check = (at: string, over: Partial<CheckRow> = {}): CheckRow =>
  ({ id: `c-${at}`, checked_at: at, result: 'pass', note: null, ...over });
const verification = (at: string, over: Partial<VerificationRow> = {}): VerificationRow =>
  ({ id: `v-${at}`, checked_at: at, result: 'pass', note: null, evidence_url: null, ...over });

describe('recordHistory', () => {
  it('merges the two sources, newest first', () => {
    const events = recordHistory({
      checks: [check('2026-09-21T06:00:00Z'), check('2026-09-25T06:00:00Z')],
      verifications: [verification('2026-09-23T09:00:00Z')],
    });
    expect(events.map((e) => [e.kind, e.at.toISOString()])).toEqual([
      ['check', '2026-09-25T06:00:00.000Z'],
      ['verification', '2026-09-23T09:00:00.000Z'],
      ['check', '2026-09-21T06:00:00.000Z'],
    ]);
  });

  it('breaks a tie on the row id, so the order is stable between builds', () => {
    const a = recordHistory({ checks: [check('2026-09-21T06:00:00Z', { id: 'b' }), check('2026-09-21T06:00:00Z', { id: 'a' })] });
    const b = recordHistory({ checks: [check('2026-09-21T06:00:00Z', { id: 'a' }), check('2026-09-21T06:00:00Z', { id: 'b' })] });
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id));
  });

  it('carries what each kind of row actually recorded', () => {
    const [warn] = recordHistory({ checks: [check('2026-09-25T06:00:00Z', { result: 'warn', note: 'blocked' })] });
    expect(warn).toMatchObject({ kind: 'check', result: 'warn', note: 'blocked' });
    const [human] = recordHistory({ verifications: [verification('2026-09-23T09:00:00Z', { note: 'Walked through the flow', evidence_url: 'https://e.example' })] });
    expect(human).toMatchObject({ kind: 'verification', result: 'pass', note: 'Walked through the flow', evidenceUrl: 'https://e.example' });
  });

  it('records the end date the offer carries', () => {
    expect(recordHistory({ expires: '2026-12-01' }).map((e) => e.kind)).toEqual(['ends']);
  });

  // offers.updated_at is bumped by the checker's own UPDATE (the trigger fires
  // on every write, including record_link_check_batch), so it cannot be read as
  // "a person edited this entry". Printing it as one would be the only false
  // line on the page.
  it('does not read the update stamp as a human edit', () => {
    expect(recordHistory({ updatedAt: '2026-09-20T12:00:00Z' })).toEqual([]);
  });

  it('invents nothing: no rows, no history', () => {
    expect(recordHistory({})).toEqual([]);
    expect(recordHistory({ checks: [], verifications: [] })).toEqual([]);
  });

  it('never manufactures an event from the projection on offers', () => {
    // `lastChecked` / `lastCheckResult` describe the newest link_checks row,
    // which is already in `checks`. Passing them must add nothing.
    const events = recordHistory({ checks: [check('2026-09-25T06:00:00Z')] } as never);
    expect(events).toHaveLength(1);
    expect(events.every((e) => e.kind === 'check')).toBe(true);
  });

  it('skips a row whose date cannot be read rather than dating it now', () => {
    expect(recordHistory({ checks: [check('not-a-date')] })).toEqual([]);
    expect(recordHistory({ expires: 'not-a-date' })).toEqual([]);
  });

  it('treats "ongoing" as no end date at all', () => {
    expect(recordHistory({ expires: 'ongoing' })).toEqual([]);
  });
});
