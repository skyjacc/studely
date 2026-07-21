import type { APIRoute } from 'astro';
import { createSupabaseServer, supabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

/**
 * Landing point for the emailed magic link. Exchanges the one-time code for a
 * session and writes the auth cookies, then hands off to the middleware, which
 * is what actually decides whether this account may see /admin.
 */
export const GET: APIRoute = async ({ url, request, cookies, redirect }) => {
  if (!supabaseConfigured) return redirect('/admin/login', 302);

  // `?error=` means GoTrue rejected the link before we ever saw a code — an expired
  // or already-consumed token, most often. Pass the reason on instead of dropping the
  // visitor on a blank form: an unexplained failure here already sent one debugging
  // session after SMTP when the real answer was in the query string.
  const authError = url.searchParams.get('error_code') ?? url.searchParams.get('error');
  if (authError) {
    console.error('[admin-callback] provider rejected the link', {
      code: authError,
      description: url.searchParams.get('error_description'),
    });
    return redirect(`/admin/login?reason=${encodeURIComponent(authError)}`, 302);
  }

  const code = url.searchParams.get('code');
  if (!code) return redirect('/admin/login?reason=missing_code', 302);

  // Only ever bounce to a path on this site. Checking `startsWith('/')` is not
  // enough: browsers resolve a backslash like a slash, so `/\evil.com` parses to
  // the authority evil.com. Resolve against our own origin and compare.
  const requested = url.searchParams.get('next') ?? '/admin';
  let next = '/admin';
  try {
    const target = new URL(requested, url.origin);
    if (target.origin === url.origin && target.pathname.startsWith('/admin')) {
      next = target.pathname + target.search;
    }
  } catch {
    /* malformed → fall back to /admin */
  }

  const supabase = createSupabaseServer(request, cookies);
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('[admin-callback] code exchange failed', {
      code: (error as { code?: string }).code,
      status: error.status,
      message: error.message,
    });
    // PKCE: the verifier lives in a cookie, so opening the link in a different
    // browser than the one that requested it fails here and nowhere else.
    return redirect('/admin/login?reason=exchange_failed', 302);
  }

  return redirect(next, 302);
};
