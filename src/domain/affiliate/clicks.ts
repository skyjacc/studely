// Affiliate domain — the money path. Resolves where a /go redirect should send a
// visitor (affiliate link first) and logs the click. Kept apart from the site so
// affiliate links, tracking and later ROI evolve on their own.

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RedirectOffer {
  id: string;
  url: string;
  affiliate_url: string | null;
  fallback_url: string | null;
  tracking_source: string | null;
  tracking_campaign: string | null;
}

export const REDIRECT_COLUMNS = 'id,url,affiliate_url,fallback_url,tracking_source,tracking_campaign';

/**
 * The destination for a /go redirect: the affiliate link if set, else the plain
 * url, else a fallback. Campaign tracking is appended (utm_*) when present and
 * not already on the URL. Returns null if there is nothing to redirect to.
 */
export function resolveTarget(o: RedirectOffer): string | null {
  const base = o.affiliate_url || o.url || o.fallback_url;
  if (!base) return null;
  if (!o.tracking_source && !o.tracking_campaign) return base;
  try {
    const u = new URL(base);
    if (o.tracking_source && !u.searchParams.has('utm_source')) u.searchParams.set('utm_source', o.tracking_source);
    if (o.tracking_campaign && !u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', o.tracking_campaign);
    return u.href;
  } catch {
    return base;
  }
}

/** Log a click. Fire-and-forget — a logging failure must never block the redirect. */
export async function logClick(
  db: SupabaseClient,
  input: { offerId: string; slug: string; source: string | null; referrer: string | null },
): Promise<void> {
  const { error } = await db.from('offer_clicks').insert({
    offer_id: input.offerId,
    slug: input.slug,
    source: input.source,
    referrer: input.referrer,
  });
  if (error) console.error(`[clicks] failed to log ${input.slug}: ${error.message}`);
}
