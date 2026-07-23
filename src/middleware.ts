import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer, isStaff, supabaseConfigured, type StaffProfile } from '@core/supabase';

/**
 * Gate for /admin. Everything else — the entire public directory — short-circuits
 * on the first line, so the static site pays nothing for this.
 *
 * The check is server-side on every request. Hiding the link in the UI is not
 * access control; this is.
 */
/**
 * Vercel keeps every deployment reachable on its own *.vercel.app hostname, so the
 * production build answers on several origins at once.
 *
 * SCOPE: middleware only runs for on-demand routes. Prerendered pages are served
 * straight from the CDN and never reach this, so this does NOT fold the public
 * directory onto one host — those rely on the canonical tag in Layout.astro, which
 * already points at the configured origin. What this does cover is /admin, which
 * has no business answering on more than one hostname.
 *
 * Only in `production`: preview deployments are supposed to answer on their own
 * hostname, and redirecting them would make every preview untestable.
 */
function canonicalRedirect(url: URL): URL | null {
  if (process.env.VERCEL_ENV !== 'production') return null;
  const canonical = process.env.PUBLIC_SITE_URL;
  if (!canonical) return null;

  const target = new URL(canonical);
  if (url.host === target.host) return null;

  const out = new URL(url.pathname + url.search, target);
  return out;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  const canonical = canonicalRedirect(context.url);
  // 308 keeps the method and tells crawlers the move is permanent
  if (canonical) return context.redirect(canonical.href, 308);

  if (!pathname.startsWith('/admin')) return next();
  // the login screen and its callback must stay reachable while signed out
  if (pathname === '/admin/login' || pathname.startsWith('/admin/auth')) return next();

  // Without env vars there is no auth to check — send them to the login screen,
  // which explains the setup step rather than throwing a 500.
  if (!supabaseConfigured) return context.redirect('/admin/login', 302);

  const supabase = createSupabaseServer(context.request, context.cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    const next_ = encodeURIComponent(pathname + context.url.search);
    return context.redirect(`/admin/login?next=${next_}`, 302);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, handle, role, is_banned')
    .eq('id', user.id)
    .maybeSingle<StaffProfile>();

  // Signed in but not staff: sign-up is open (comments need it), the admin is not.
  if (!isStaff(profile)) return context.redirect('/admin/login?denied=1', 302);

  context.locals.user = { id: user.id, email: user.email ?? '' };
  context.locals.profile = profile!;
  return next();
});
