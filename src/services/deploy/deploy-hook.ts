// Fire a Vercel Deploy Hook so a content change reaches the static public site.
// The public pages are prerendered (P1), so they only pick up DB edits on a
// redeploy. Publishing — or editing a live offer — POSTs the hook to rebuild.
//
// The owner creates the hook once (Vercel → Project → Settings → Git → Deploy
// Hooks) and sets VERCEL_DEPLOY_HOOK_URL. If it is unset the edit still saves,
// but the caller receives an honest "skipped" result. Hook failures are returned,
// never raised — a broken hook must not roll back an editor save.

export type DeployResult =
  | { status: 'triggered'; httpStatus: number }
  | { status: 'skipped'; message: string }
  | { status: 'failed'; message: string; httpStatus?: number };

export function shouldTriggerDeployForVisibility(before: string, after: string): boolean {
  return before === 'published' || after === 'published';
}

export async function triggerDeploy(reason: string): Promise<DeployResult> {
  const url = process.env.VERCEL_DEPLOY_HOOK_URL;
  if (!url) {
    console.info(`[deploy-hook] skipped (${reason}) — VERCEL_DEPLOY_HOOK_URL is unset`);
    return {
      status: 'skipped',
      message: 'VERCEL_DEPLOY_HOOK_URL is not configured.',
    };
  }
  try {
    const res = await fetch(url, { method: 'POST' });
    if (!res.ok) {
      const message = `Deploy hook returned HTTP ${res.status}.`;
      console.error(`[deploy-hook] failed (${reason}) → HTTP ${res.status}`);
      return { status: 'failed', httpStatus: res.status, message };
    }
    console.info(`[deploy-hook] fired (${reason}) → HTTP ${res.status}`);
    return { status: 'triggered', httpStatus: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deploy-hook] failed (${reason}):`, message);
    return { status: 'failed', message };
  }
}
