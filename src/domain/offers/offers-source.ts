// Build-time source of offers, reading Supabase instead of the Markdown
// collection. Uses a session-less anon client (published rows are public under
// RLS) and caches the full published set for the duration of one build, since
// every page asks for it.

import { createSupabaseBuild } from '@core/supabase';
import { mapOfferRow, type OfferView, type OfferRow, type AttrRow } from './offer-mapping';

const OFFER_COLUMNS =
  'id,slug,title,provider,category,summary,value,body,offer_type,discount_percent,url,affiliate,sponsored,featured,verification,eligibility,tags,score,status,expires_at,last_checked';

async function loadOffers(): Promise<OfferView[]> {
  const db = createSupabaseBuild();

  const { data: rows, error } = await db
    .from('offers')
    .select(OFFER_COLUMNS)
    .eq('visibility', 'published');
  if (error) throw new Error(`Failed to load offers from Supabase: ${error.message}`);

  const offerRows = (rows ?? []) as unknown as OfferRow[];

  // Never build an empty directory — an empty published set is always a fault
  // (bad env, wrong project, unrun migration), not a legitimate state.
  if (offerRows.length === 0) {
    throw new Error('Supabase returned 0 published offers — refusing to build an empty directory.');
  }

  const ids = offerRows.map((r) => r.id);
  const { data: attrRows, error: attrError } = await db
    .from('offer_attributes')
    .select('offer_id,key,label,points')
    .in('offer_id', ids);
  if (attrError) throw new Error(`Failed to load offer_attributes: ${attrError.message}`);

  const byOffer = new Map<string, { key: string; label: string; points: number }[]>();
  for (const a of (attrRows ?? []) as AttrRow[]) {
    const list = byOffer.get(a.offer_id) ?? [];
    list.push({ key: a.key, label: a.label, points: a.points });
    byOffer.set(a.offer_id, list);
  }

  // Verification signal: the latest human check per offer. Verified ONLY when the
  // most recent verification passed — never inferred from status, so the badge
  // can't lie. No verifications yet → verified:false for everyone (honest).
  const { data: verifRows, error: verifError } = await db
    .from('verifications')
    .select('offer_id,result,checked_at')
    .in('offer_id', ids)
    .order('checked_at', { ascending: false });
  if (verifError) throw new Error(`Failed to load verifications: ${verifError.message}`);

  const verifiedBy = new Map<string, { verified: boolean; at: string | null }>();
  for (const v of (verifRows ?? []) as { offer_id: string; result: string; checked_at: string }[]) {
    if (verifiedBy.has(v.offer_id)) continue; // newest-first; keep only the latest
    verifiedBy.set(v.offer_id, { verified: v.result === 'pass', at: v.result === 'pass' ? v.checked_at : null });
  }

  return offerRows.map((r) => mapOfferRow(r, byOffer.get(r.id) ?? [], verifiedBy.get(r.id)));
}

let cache: Promise<OfferView[]> | null = null;

/** All published offers, mapped to the collection-entry shape. Cached per build. */
export function getAllOffers(): Promise<OfferView[]> {
  return (cache ??= loadOffers());
}

/** One published offer by slug, or null. */
export async function getOffer(slug: string): Promise<OfferView | null> {
  return (await getAllOffers()).find((o) => o.slug === slug) ?? null;
}
