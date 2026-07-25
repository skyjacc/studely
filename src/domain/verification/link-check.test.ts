import { describe, expect, it } from 'vitest';
import { classifyOfferCheck, dedupeWrites, type CheckedOffer } from './link-check';

const offer: CheckedOffer = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'github-student-pack',
  title: 'GitHub Student Developer Pack',
  url: 'https://education.github.com/pack',
  expires: null,
  status: 'unverified',
};
const checkedAt = new Date('2026-07-23T12:00:00.000Z');

describe('classifyOfferCheck', () => {
  it('treats a successful HTTP response as pass and restores active status', () => {
    const result = classifyOfferCheck(offer, { status: 200, finalUrl: offer.url! }, checkedAt);
    expect(result.reportStatus).toBe('ok');
    expect(result.write).toEqual({
      offer_id: offer.id,
      result: 'pass',
      ok: true,
      status_code: 200,
      error: null,
      final_url: offer.url,
      checked_at: checkedAt.toISOString(),
      offer_status: 'active',
    });
  });

  it.each([401, 403, 405, 406, 429])('treats HTTP %s as a warning, not a dead link', (status) => {
    const result = classifyOfferCheck(offer, { status, finalUrl: offer.url! }, checkedAt);
    expect(result.reportStatus).toBe('BLOCKED');
    expect(result.write.result).toBe('warn');
    expect(result.write.ok).toBe(true);
    expect(result.write.offer_status).toBe('active');
  });

  it('treats other HTTP failures as dead and marks the offer unverified', () => {
    const result = classifyOfferCheck({ ...offer, status: 'active' }, { status: 500 }, checkedAt);
    expect(result.reportStatus).toBe('DEAD');
    expect(result.write.result).toBe('fail');
    expect(result.write.ok).toBe(false);
    expect(result.write.offer_status).toBe('unverified');
  });

  it('records network errors without pretending status 0 is an HTTP code', () => {
    const result = classifyOfferCheck(offer, { status: 0, error: 'timeout' }, checkedAt);
    expect(result.reportStatus).toBe('UNREACHABLE');
    expect(result.write.status_code).toBeNull();
    expect(result.write.error).toBe('timeout');
  });

  // A timeout, reset or TLS failure is us not reaching the offer — not the
  // provider saying it is gone. Autodesk and Azure both answer in a browser but
  // time out from CI, so demoting them would publish a false "broken" claim.
  it('does not demote an offer we simply could not reach', () => {
    const result = classifyOfferCheck({ ...offer, status: 'active' }, { status: 0, error: 'timeout' }, checkedAt);
    expect(result.write.result).toBe('warn');
    expect(result.write.ok).toBe(true);
    expect(result.write.offer_status).toBe('active');
  });

  it('marks an offer expired only after its inclusive expiry date has passed', () => {
    const onExpiryDay = classifyOfferCheck(
      { ...offer, expires: '2026-07-23' },
      { status: 200 },
      checkedAt,
    );
    const nextDay = classifyOfferCheck(
      { ...offer, expires: '2026-07-22' },
      { status: 200 },
      checkedAt,
    );
    expect(onExpiryDay.reportStatus).toBe('ok');
    expect(onExpiryDay.write.offer_status).toBe('active');
    expect(nextDay.reportStatus).toBe('EXPIRED');
    expect(nextDay.write.offer_status).toBe('expired');
  });

  it('preserves expiring status after a healthy or blocked check', () => {
    expect(
      classifyOfferCheck({ ...offer, status: 'expiring' }, { status: 200 }, checkedAt).write.offer_status,
    ).toBe('expiring');
    expect(
      classifyOfferCheck({ ...offer, status: 'expiring' }, { status: 403 }, checkedAt).write.offer_status,
    ).toBe('expiring');
  });

  it('ignores an invalid expiry string instead of crashing or expiring it', () => {
    const result = classifyOfferCheck({ ...offer, expires: 'not-a-date' }, { status: 200 }, checkedAt);
    expect(result.reportStatus).toBe('ok');
    expect(result.write.offer_status).toBe('active');
  });
});

describe('dedupeWrites', () => {
  it('keeps first-seen order while the last result for an offer wins', () => {
    const first = classifyOfferCheck(offer, { status: 500 }, checkedAt).write;
    const secondOffer = { ...offer, id: '22222222-2222-2222-2222-222222222222', slug: 'figma' };
    const second = classifyOfferCheck(secondOffer, { status: 200 }, checkedAt).write;
    const replacement = classifyOfferCheck(offer, { status: 200 }, checkedAt).write;

    expect(dedupeWrites([first, second, replacement])).toEqual([replacement, second]);
  });
});
