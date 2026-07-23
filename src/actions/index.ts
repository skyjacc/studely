// The admin JSON API, as Astro Actions. Mutations are typed server functions the
// client calls as actions.offers.create({...}) → { data, error }. They reuse the
// same pure validation (offer-input.ts) and IO (admin-offers.ts) the SSR pages
// used, so this is a transport swap, not a logic rewrite.
//
// SECURITY: actions POST to /_actions/*, which does NOT match the /admin prefix
// the middleware gate watches — so these handlers cannot rely on the middleware.
// Every offer action calls requireStaff() itself, and the DB's RLS (offers_staff)
// is the hard backstop. auth.requestLink is public by design (it is the sign-in).

import { defineAction, ActionError } from 'astro:actions';
import { z } from 'astro:schema';
import type { AstroCookies } from 'astro';
import { createSupabaseServer, isStaff, type StaffProfile } from '@core/supabase';
import { validateOfferInput, type OfferFormRaw } from '@domain/offers/offer-input';
import {
  createOffer, updateOffer, setVisibility, deleteOffer, replaceAttributes, getOfferForEdit,
} from '@domain/offers/admin-offers';
import { triggerDeploy } from '@services/deploy/deploy-hook';

type Ctx = { request: Request; cookies: AstroCookies };

const OfferFields = z.object({
  title: z.string().optional(),
  provider: z.string().optional(),
  category: z.string().optional(),
  summary: z.string().optional(),
  value: z.string().optional(),
  body: z.string().optional(),
  url: z.string().optional(),
  verification: z.string().optional(),
  eligibility: z.string().optional(),
  offer_type: z.string().optional(),
  discount_percent: z.string().optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  expires_at: z.string().optional(),
  affiliate: z.boolean().optional(),
  sponsored: z.boolean().optional(),
  featured: z.boolean().optional(),
  ongoing: z.boolean().optional(),
});

async function requireStaff(ctx: Ctx) {
  const supabase = createSupabaseServer(ctx.request, ctx.cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Sign in first.' });
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, role, is_banned')
    .eq('id', user.id)
    .maybeSingle<StaffProfile>();
  if (!isStaff(profile)) throw new ActionError({ code: 'FORBIDDEN', message: 'Admin access required.' });
  return { supabase, userId: user.id };
}

export const server = {
  offers: {
    create: defineAction({
      input: OfferFields.extend({ slug: z.string().optional() }),
      handler: async (raw, ctx) => {
        const { supabase, userId } = await requireStaff(ctx);
        const { errors, value } = validateOfferInput(raw as OfferFormRaw, { requireSlug: true });
        if (!value) return { ok: false as const, errors };
        const res = await createOffer(supabase, value, userId);
        if (!res.ok) return { ok: false as const, errors: { slug: res.error ?? 'Could not create the offer' } };
        return { ok: true as const, slug: res.slug };
      },
    }),

    update: defineAction({
      input: OfferFields.extend({ slug: z.string(), attrs: z.array(z.string()).optional() }),
      handler: async (raw, ctx) => {
        const { supabase } = await requireStaff(ctx);
        const existing = await getOfferForEdit(supabase, raw.slug);
        if (!existing) throw new ActionError({ code: 'NOT_FOUND', message: 'Offer not found.' });
        const { errors, value } = validateOfferInput(raw as OfferFormRaw, { requireSlug: false });
        if (!value) return { ok: false as const, errors };
        const u = await updateOffer(supabase, raw.slug, value);
        if (!u.ok) return { ok: false as const, errors: { _: u.error ?? 'Could not save' } };
        const a = await replaceAttributes(supabase, existing.row.id, raw.attrs ?? []);
        if (!a.ok) return { ok: false as const, errors: { _: a.error ?? 'Fields saved, attributes failed' } };
        if (existing.row.visibility === 'published') await triggerDeploy('save ' + raw.slug);
        const after = await getOfferForEdit(supabase, raw.slug);
        return { ok: true as const, score: after?.row.score ?? null };
      },
    }),

    setVisibility: defineAction({
      input: z.object({ slug: z.string(), visibility: z.enum(['draft', 'published', 'archived']) }),
      handler: async ({ slug, visibility }, ctx) => {
        const { supabase } = await requireStaff(ctx);
        const res = await setVisibility(supabase, slug, visibility);
        if (!res.ok) throw new ActionError({ code: 'BAD_REQUEST', message: res.error ?? 'Could not change visibility' });
        await triggerDeploy(`${visibility} ${slug}`);
        return { ok: true as const, visibility };
      },
    }),

    remove: defineAction({
      input: z.object({ slug: z.string() }),
      handler: async ({ slug }, ctx) => {
        const { supabase } = await requireStaff(ctx);
        const existing = await getOfferForEdit(supabase, slug);
        const wasPublished = existing?.row.visibility === 'published';
        const res = await deleteOffer(supabase, slug);
        if (!res.ok) throw new ActionError({ code: 'BAD_REQUEST', message: res.error ?? 'Could not delete' });
        if (wasPublished) await triggerDeploy('delete ' + slug);
        return { ok: true as const };
      },
    }),
  },

  auth: {
    // accept: 'form' keeps a no-JS fallback — <form action={actions.auth.requestLink}>
    // still works, and the client can call it too. Auth stays server-side: the OTP
    // request runs here and the session lands in httpOnly cookies, never in JS.
    requestLink: defineAction({
      accept: 'form',
      input: z.object({ email: z.string(), next: z.string().optional() }),
      handler: async ({ email, next }, ctx) => {
        const e = email.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
          return { ok: false as const, error: 'Enter a valid email address.' };
        }
        const supabase = createSupabaseServer(ctx.request, ctx.cookies);
        const redirectTo = new URL('/admin/auth/callback', new URL(ctx.request.url).origin);
        redirectTo.searchParams.set('next', next || '/admin');
        const { error } = await supabase.auth.signInWithOtp({
          email: e,
          options: { shouldCreateUser: false, emailRedirectTo: redirectTo.href },
        });
        if (error) {
          console.error('[admin-login] signInWithOtp failed', {
            code: (error as { code?: string }).code, status: error.status, message: error.message,
          });
          const code = (error as { code?: string }).code;
          return {
            ok: false as const,
            error: code === 'otp_disabled'
              ? 'No link sent. Admin accounts are invited, not self-served.'
              : 'Could not send the link. Try again in a moment.',
          };
        }
        return { ok: true as const, email: e };
      },
    }),
  },
};
