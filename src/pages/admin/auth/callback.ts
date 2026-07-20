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

  const code = url.searchParams.get('code');
  if (!code) return redirect('/admin/login?denied=0', 302);

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
  if (error) return redirect('/admin/login', 302);

  return redirect(next, 302);
};
