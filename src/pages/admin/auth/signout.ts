import type { APIRoute } from 'astro';
import { createSupabaseServer, supabaseConfigured } from '../../../lib/supabase';

export const prerender = false;

/** POST-only: a link that signs you out can be triggered by any page you visit. */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (supabaseConfigured) {
    const supabase = createSupabaseServer(request, cookies);
    const { error } = await supabase.auth.signOut();
    // Reported, not swallowed: a failed signOut leaves the session cookies in place,
    // so the visitor lands on the login screen believing they are signed out while
    // the session is still live. That is worth seeing in the logs.
    if (error) {
      console.error('[admin-signout] signOut failed', { status: error.status, message: error.message });
    }
  }
  return redirect('/admin/login', 302);
};
