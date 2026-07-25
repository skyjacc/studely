// Staff-session offer mutations for the admin editor. Every call runs under the
// signed-in admin's RLS (policies offers_staff / attrs_staff), so authorization
// is the database's job, not this layer's. Pure input handling lives in
// offer-input.ts; this is the IO around it.

import type { SupabaseClient } from '@supabase/supabase-js';
import { selectedAttributes, type OfferInput } from './offer-input';

export interface AdminOfferRow {
  id: string;
  slug: string;
  title: string;
  provider: string;
  category: string;
  value: string;
  offer_type: string;
  score: number;
  status: string;
  visibility: string;
  featured: boolean;
  sponsored: boolean;
  last_checked: string;
}

const LIST_COLUMNS =
  'id,slug,title,provider,category,value,offer_type,score,status,visibility,featured,sponsored,last_checked';

/** Every offer, all visibilities — this is the operator's library view. */
export async function listAllOffers(db: SupabaseClient): Promise<AdminOfferRow[]> {
  const { data, error } = await db
    .from('offers')
    .select(LIST_COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(`Failed to load offers: ${error.message}`);
  return (data ?? []) as unknown as AdminOfferRow[];
}

export interface OfferForEdit {
  row: Record<string, unknown> & { id: string; slug: string; visibility: string; score: number };
  attributeKeys: string[];
}

/** One offer plus the keys of its scoring attributes, for the editor. */
export async function getOfferForEdit(db: SupabaseClient, slug: string): Promise<OfferForEdit | null> {
  const { data, error } = await db
    .from('offers')
    .select('*, offer_attributes(key)')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new Error(`Failed to load offer: ${error.message}`);
  if (!data) return null;
  const { offer_attributes, ...row } = data as Record<string, unknown> & {
    offer_attributes?: { key: string }[];
  };
  return {
    row: row as OfferForEdit['row'],
    attributeKeys: (offer_attributes ?? []).map((a) => a.key),
  };
}

export interface MutationResult {
  ok: boolean;
  error?: string;
  slug?: string;
  score?: number;
}

/** Columns the editor may write — never score, visibility, slug (post-create), or the audit fields. */
function toRow(input: OfferInput) {
  return {
    title: input.title,
    provider: input.provider,
    category: input.category,
    summary: input.summary,
    value: input.value,
    body: input.body,
    offer_type: input.offer_type,
    discount_percent: input.discount_percent,
    url: input.url,
    affiliate: input.affiliate,
    sponsored: input.sponsored,
    featured: input.featured,
    verification: input.verification,
    eligibility: input.eligibility,
    tags: input.tags,
    status: input.status,
    expires_at: input.expires_at,
  };
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'That slug is already taken — pick another.';
  return error.message;
}

/** Insert a new offer as a draft. Slug uniqueness is enforced by the DB. */
export async function createOffer(db: SupabaseClient, input: OfferInput, userId: string): Promise<MutationResult> {
  const { error } = await db.from('offers').insert({
    ...toRow(input),
    slug: input.slug,
    created_by: userId,
  });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, slug: input.slug };
}

/** Update an existing offer's editable fields. Does not touch slug/score/visibility. */
export async function updateOffer(db: SupabaseClient, slug: string, input: OfferInput): Promise<MutationResult> {
  const { error } = await db.from('offers').update(toRow(input)).eq('slug', slug);
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, slug };
}

/**
 * Update editable fields and replace scoring attributes in one Postgres
 * transaction. The RPC is SECURITY INVOKER, so the signed-in staff session and
 * existing RLS policies remain the authorization boundary.
 */
export async function updateOfferWithAttributes(
  db: SupabaseClient,
  slug: string,
  input: OfferInput,
  keys: string[],
): Promise<MutationResult> {
  const attributeRows = selectedAttributes(keys).map(({ key, label, points }) => ({
    key,
    label,
    points,
  }));
  const { data, error } = await db.rpc('update_offer_with_attributes', {
    offer_slug: slug,
    offer_patch: toRow(input),
    attribute_rows: attributeRows,
  });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, slug, score: typeof data === 'number' ? data : undefined };
}

/** draft ↔ published ↔ archived, by explicit operator action. */
export async function setVisibility(db: SupabaseClient, slug: string, visibility: string): Promise<MutationResult> {
  const { error } = await db.from('offers').update({ visibility }).eq('slug', slug);
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, slug };
}

export async function deleteOffer(db: SupabaseClient, slug: string): Promise<MutationResult> {
  const { error } = await db.from('offers').delete().eq('slug', slug);
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true };
}

/**
 * Replace an offer's scoring attributes with the given vocabulary keys.
 * Delete-then-insert; the DB trigger recomputes offers.score after each change.
 */
export async function replaceAttributes(db: SupabaseClient, offerId: string, keys: string[]): Promise<MutationResult> {
  const rows = selectedAttributes(keys).map((a) => ({
    offer_id: offerId,
    key: a.key,
    label: a.label,
    points: a.points,
  }));
  const del = await db.from('offer_attributes').delete().eq('offer_id', offerId);
  if (del.error) return { ok: false, error: del.error.message };
  if (rows.length > 0) {
    const ins = await db.from('offer_attributes').insert(rows);
    if (ins.error) return { ok: false, error: ins.error.message };
  }
  return { ok: true };
}
