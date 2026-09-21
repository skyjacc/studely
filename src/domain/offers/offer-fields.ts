// The one declaration per editable offer field. Everything that writes or renders
// an offer field derives from this list: the admin form, the client serializer,
// the Action schema, validation, toRow(), and the editor read-back. The SQL RPC
// keeps an explicit column list on purpose (no dynamic SQL) — offer-fields.test.ts
// fails the build when the two drift. That drift is how affiliate_url reached the
// database in 0006 and never reached the form.

import { categorySlugs } from './categories';

export type FieldInput = 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date' | 'url';

export interface OfferField {
  /** Form control name AND offers column name — one identifier, by design. */
  name: string;
  input: FieldInput;
  required: boolean;
  label: string;
  /** Muted hint next to the label. */
  hint?: string;
  placeholder?: string;
  /** For `select`. */
  options?: readonly string[];
  /** How the form string becomes the stored value. Default: trimmed string. */
  parse?: 'tags' | 'int-or-null' | 'date-or-null' | 'null-if-empty';
}

export const OFFER_FIELDS: readonly OfferField[] = [
  { name: 'title', input: 'text', required: true, label: 'Title' },
  { name: 'provider', input: 'text', required: true, label: 'Provider' },
  { name: 'category', input: 'select', required: true, label: 'Category', options: categorySlugs },
  { name: 'summary', input: 'text', required: true, label: 'Summary', hint: 'one-line hook' },
  { name: 'value', input: 'text', required: true, label: 'Value', hint: 'headline, e.g. "$200k+ in tools"' },
  { name: 'offer_type', input: 'select', required: true, label: 'Offer type', options: ['free', 'discount', 'credit', 'trial'] },
  { name: 'discount_percent', input: 'number', required: false, label: 'Discount percent', hint: 'only for a discount offer', placeholder: '50', parse: 'int-or-null' },
  { name: 'url', input: 'url', required: true, label: 'Destination URL', placeholder: 'https://…' },
  // /go/<slug> prefers this over url when set. Public pages never link it directly.
  { name: 'affiliate_url', input: 'url', required: false, label: 'Affiliate URL', hint: 'partner link; /go prefers it over the destination URL', placeholder: 'https://…', parse: 'null-if-empty' },
  // Was `verification` until 0012 — that word now belongs to the human check only.
  { name: 'proof_method', input: 'text', required: true, label: 'Proof method', hint: 'how a student proves eligibility', placeholder: 'SheerID' },
  { name: 'eligibility', input: 'text', required: true, label: 'Who qualifies', placeholder: 'e.g. Students 18+ at accredited institutions (US only)' },
  { name: 'status', input: 'select', required: true, label: 'Status', options: ['active', 'expiring', 'expired', 'unverified'] },
  { name: 'expires_at', input: 'date', required: false, label: 'Expires', hint: 'or tick ongoing', parse: 'date-or-null' },
  { name: 'tags', input: 'text', required: false, label: 'Tags', hint: 'comma-separated', placeholder: 'github, bundle, dev', parse: 'tags' },
  { name: 'affiliate', input: 'checkbox', required: false, label: 'Affiliate link' },
  { name: 'sponsored', input: 'checkbox', required: false, label: 'Sponsored' },
  { name: 'featured', input: 'checkbox', required: false, label: 'Featured on homepage' },
  { name: 'body', input: 'textarea', required: false, label: 'Body', hint: 'Markdown, the offer detail page' },
];

export const EDITABLE_COLUMNS: readonly string[] = OFFER_FIELDS.map((f) => f.name);

export const fieldByName = new Map(OFFER_FIELDS.map((f) => [f.name, f]));

/**
 * Rows of the editor form, in order. Every registry field must appear exactly
 * once (offer-fields.test.ts enforces it) — a field cannot be added to the
 * database and forgotten in the form again. Two names on a row = two columns.
 * A row of checkboxes renders as the flags strip; expires_at renders with the
 * `ongoing` tick beside it.
 */
export const FORM_LAYOUT: readonly (readonly string[])[] = [
  ['title'],
  ['provider', 'category'],
  ['summary'],
  ['value', 'offer_type'],
  ['discount_percent'],
  ['url'],
  ['affiliate_url'],
  ['proof_method', 'eligibility'],
  ['status', 'expires_at'],
  ['tags'],
  ['affiliate', 'sponsored', 'featured'],
  ['body'],
];

/** Database row → the string/boolean values the form controls expect. */
export function rowToForm(row: Record<string, unknown>): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const f of OFFER_FIELDS) {
    const v = row[f.name];
    if (f.input === 'checkbox') out[f.name] = Boolean(v);
    else if (f.parse === 'tags') out[f.name] = Array.isArray(v) ? v.join(', ') : '';
    else out[f.name] = v == null ? '' : String(v);
  }
  return out;
}
