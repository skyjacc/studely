import type { APIRoute } from 'astro';
import { createSupabaseServer, supabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

/** POST-only: a link that signs you out can be triggered by any page you visit. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (supabaseConfigured) {
    const supabase = createSupabaseServer(request, cookies);
    await supabase.auth.signOut();
  }
  return redirect('/admin/login', 302);
};
