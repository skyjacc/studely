import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { dashboardMetrics, type MetricOffer } from './metrics';

// The fixtures next door prove the definitions. This proves the layer survives
// contact with the real catalogue: that the rows the database actually holds
// pass through it without contradicting themselves.
//
// It asserts INVARIANTS, not today's numbers — "every published offer is in
// exactly one health bucket" stays true next week, where "pass = 10" would
// become a test that fails when the checker does its job. Skipped without
// credentials; CI runs the fixtures.

const live = Boolean(process.env.PUBLIC_SUPABASE_URL && process.env.PUBLIC_SUPABASE_ANON_KEY);

describe.runIf(live)('the metric layer against the real catalogue', () => {
  it('reads it without contradicting itself', async () => {
    const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data, error } = await db
      .from('offers')
      .select('slug,provider,title,visibility,expires_at,last_checked,last_check_result,last_check_note,status');
    expect(error, error?.message).toBeNull();

    const offers: MetricOffer[] = (data ?? []).map((o) => {
      const row = o as Record<string, string | null>;
      return {
        slug: row.slug!, provider: row.provider!, title: row.title!,
        visibility: row.visibility!,
        expires: row.expires_at ?? 'ongoing',
        lastChecked: row.last_checked ? new Date(row.last_checked) : null,
        lastCheckResult: (row.last_check_result ?? null) as MetricOffer['lastCheckResult'],
        lastCheckNote: (row.last_check_note ?? null) as MetricOffer['lastCheckNote'],
        verified: false, // anon sees no verifications; the fixtures cover that path
        status: row.status!,
      };
    });
    expect(offers.length, 'anon must be able to read the published catalogue').toBeGreaterThan(0);

    const m = dashboardMetrics({ offers, clicks: [] });
    const { catalogue, health } = m;

    // every published offer lands in exactly one health bucket
    expect(health.pass + health.warn + health.fail + health.unchecked).toBe(catalogue.published);
    // every warning is accounted for by a reason
    expect(health.warnings.blocked + health.warnings.unreachable + health.warnings.unconfirmed).toBe(health.warn);
    // nothing on the attention list is a healthy offer, and each carries words
    for (const item of health.needsAttention) {
      expect(item.text.length, item.slug).toBeGreaterThan(0);
      expect(item.state).not.toBe('pass');
    }
    // the stated last check is the newest one the catalogue holds
    const newest = offers.reduce<Date | null>((acc, o) => (o.lastChecked && (!acc || o.lastChecked > acc) ? o.lastChecked : acc), null);
    expect(health.lastCheck).toEqual(newest);
    // and no expiry is invented from the checker's status column
    const statusSaysExpired = offers.filter((o) => o.status === 'expired').length;
    const datesPast = offers.filter((o) => o.visibility === 'published' && o.expires !== 'ongoing' && o.expires < new Date().toISOString().slice(0, 10)).length;
    expect(catalogue.expired).toBe(datesPast);
    if (statusSaysExpired !== datesPast) {
      // not a failure — it is the disagreement the contract predicted, and the
      // metric follows the date. Surface it so it is seen rather than assumed.
      console.warn(`status says ${statusSaysExpired} expired, the dates say ${datesPast}`);
    }
  }, 20_000);
});
