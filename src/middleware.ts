import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServer, isStaff, supabaseConfigured, type StaffProfile } from './lib/supabase';

/**
 * Gate for /admin. Everything else — the entire public directory — short-circuits
 * on the first line, so the static site pays nothing for this.
 *
 * The check is server-side on every request. Hiding the link in the UI is not
 * access control; this is.
 */
export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

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
