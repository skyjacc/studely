import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { updateOfferWithAttributes } from './admin-offers';
import type { OfferInput } from './offer-input';

const input: OfferInput = {
  title: 'Figma Education',
  provider: 'Figma',
  category: 'design',
  summary: 'Full plan for students.',
  value: 'Pro plan free',
  body: '## Details',
  url: 'https://figma.com/education',
  verification: 'School email',
  eligibility: 'Verified students worldwide',
  offer_type: 'free',
  discount_percent: null,
  status: 'active',
  affiliate: false,
  sponsored: false,
  featured: true,
  tags: ['design'],
  expires_at: null,
};

describe('updateOfferWithAttributes', () => {
  it('sends fields and de-duplicated known attributes through one RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 9, error: null });
    const db = { rpc } as unknown as SupabaseClient;

    const result = await updateOfferWithAttributes(db, 'figma-education', input, [
      'full_tier_free',
      'bogus',
      'full_tier_free',
      'no_card_required',
    ]);

    expect(result).toEqual({ ok: true, slug: 'figma-education', score: 9 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('update_offer_with_attributes', {
      offer_slug: 'figma-education',
      offer_patch: expect.objectContaining({
        title: input.title,
        tags: ['design'],
        expires_at: null,
      }),
      attribute_rows: [
        { key: 'full_tier_free', label: 'Full paid tier, free', points: 2 },
        { key: 'no_card_required', label: 'No payment method needed', points: 1 },
      ],
    });
  });

  it('returns the RPC error and does not report success', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'transaction rolled back' } });
    const db = { rpc } as unknown as SupabaseClient;

    await expect(updateOfferWithAttributes(db, 'figma-education', input, [])).resolves.toEqual({
      ok: false,
      error: 'transaction rolled back',
    });
  });
});
