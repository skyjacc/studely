/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  /** Server/build only — bypasses RLS, never expose to the browser. */
  readonly SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    /**
     * Set by the /admin middleware ONLY after the visitor is confirmed staff.
     *
     * Optional on purpose: the middleware returns early for /admin/login and
     * /admin/auth/* without setting these, and every non-admin route never enters
     * that branch at all. Declaring them as always-present made the type lie about
     * exactly the routes a signed-out visitor reaches first.
     */
    user?: { id: string; email: string };
    profile?: { id: string; handle: string; role: 'user' | 'moderator' | 'admin'; is_banned: boolean };
  }
}
