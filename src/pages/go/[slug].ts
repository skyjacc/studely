export const prerender = false;

import type { APIRoute } from 'astro';
import { createSupabaseBuild } from '@core/supabase';
import { REDIRECT_COLUMNS, resolveTarget, logClick, type RedirectOffer } from '@domain/affiliate/clicks';

// The tracked exit for every offer: log the click, then 302 to the affiliate
// destination. Public + unauthenticated — reads a published offer and writes a
// click under the anon RLS policy. A logging failure never blocks the redirect.
export const GET: APIRoute = async ({ params, request, url }) => {
  const slug = params.slug!;
  const db = createSupabaseBuild();

  const { data, error } = await db
    .from('offers')
    .select(REDIRECT_COLUMNS)
    .eq('slug', slug)
    .eq('visibility', 'published')
    .maybeSingle();

  const offer = (!error && data ? data : null) as RedirectOffer | null;
  const target = offer ? resolveTarget(offer) : null;
  if (!offer || !target) {
    return new Response(null, { status: 302, headers: { Location: '/offers', 'cache-control': 'no-store' } });
  }

  await logClick(db, {
    offerId: offer.id,
    slug,
    source: url.searchParams.get('src'),
    referrer: request.headers.get('referer'),
  });

  return new Response(null, { status: 302, headers: { Location: target, 'cache-control': 'no-store' } });
};
