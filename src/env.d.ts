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
    /** Set by the /admin middleware once the visitor is confirmed staff. */
    user: { id: string; email: string };
    profile: { id: string; handle: string; role: 'user' | 'moderator' | 'admin'; is_banned: boolean };
  }
}
