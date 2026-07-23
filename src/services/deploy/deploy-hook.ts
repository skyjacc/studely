// Fire a Vercel Deploy Hook so a content change reaches the static public site.
// The public pages are prerendered (P1), so they only pick up DB edits on a
// redeploy. Publishing — or editing a live offer — POSTs the hook to rebuild.
//
// The owner creates the hook once (Vercel → Project → Settings → Git → Deploy
// Hooks) and sets VERCEL_DEPLOY_HOOK_URL. If it is unset the call is a no-op, so
// edits still save and simply wait for the next manual deploy. A hook failure is
// logged, never raised — a broken hook must not block an editor save.

export async function triggerDeploy(reason: string): Promise<void> {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!url) {
    console.info(`[deploy-hook] skipped (${reason}) — VERCEL_DEPLOY_HOOK_URL is unset`);
    return;
  }
  try {
    const res = await fetch(url, { method: 'POST' });
    console.info(`[deploy-hook] fired (${reason}) → HTTP ${res.status}`);
  } catch (err) {
    console.error(`[deploy-hook] failed (${reason}):`, err instanceof Error ? err.message : err);
  }
}
