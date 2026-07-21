import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

// Read statically, never through a computed key. Vite replaces `import.meta.env.X`
// at build time only when X is a literal; a dynamic lookup makes it hand over the
// whole env object, which is how a secret ends up inlined in a client bundle.
// PUBLIC_ vars are safe to inline — that is the point of the prefix.
const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY;

/** False until .env is filled — lets pages render a setup notice instead of crashing. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Request-scoped client. Reads and writes the auth cookies, so `getUser()` here
 * reflects the signed-in visitor and every query runs under their RLS policies.
 */
export function createSupabaseServer(request: Request, cookies: AstroCookies) {
  if (!supabaseConfigured) throw new Error('Supabase env vars are missing — copy .env.example to .env');
  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    // @supabase/ssr defaults to httpOnly:false and no secure flag. The cookie holds
    // the access AND refresh token; nothing in this app reads it from JavaScript
    // (there is no browser client), so hiding it from scripts costs nothing and
    // removes the XSS -> persistent admin takeover path.
    cookieOptions: {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      // Astro's AstroCookies exposes get/set but has no getAll(), so reads come
      // straight off the request header and only writes go through Astro.
      getAll: () =>
        parseCookieHeader(request.headers.get('Cookie') ?? '').filter(
          (c): c is { name: string; value: string } => typeof c.value === 'string',
        ),
      setAll: (list) => {
        for (const { name, value, options } of list) {
          cookies.set(name, value, { ...options, path: options?.path ?? '/' });
        }
      },
    },
  });
}

/**
 * Trusted client for build-time reads and privileged writes.
 *
 * The service-role key BYPASSES Row Level Security. Only ever call this from
 * server or build code — never from a component that ships to the browser, and
 * never expose the key under a PUBLIC_ name.
 */
export function createSupabaseAdmin() {
  // process.env only, never import.meta.env: Vite can inline the latter into a
  // bundle, and this key bypasses RLS. Reading it this way means a stray import
  // from client code fails to find it rather than shipping it.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing — required for build-time and admin writes');
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type StaffRole = 'moderator' | 'admin';

export interface StaffProfile {
  id: string;
  handle: string;
  role: 'user' | StaffRole;
  is_banned: boolean;
}

/** A signed-in visitor is only staff if their profile says so and they aren't banned. */
export function isStaff(profile: StaffProfile | null): boolean {
  return Boolean(profile && !profile.is_banned && (profile.role === 'admin' || profile.role === 'moderator'));
}
