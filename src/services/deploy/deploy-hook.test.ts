import { afterEach, describe, expect, it, vi } from 'vitest';
import { shouldTriggerDeployForVisibility, triggerDeploy } from './deploy-hook';

const originalUrl = process.env.VERCEL_DEPLOY_HOOK_URL;

afterEach(() => {
  if (originalUrl === undefined) delete process.env.VERCEL_DEPLOY_HOOK_URL;
  else process.env.VERCEL_DEPLOY_HOOK_URL = originalUrl;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('triggerDeploy', () => {
  it('reports skipped when the hook is not configured', async () => {
    delete process.env.VERCEL_DEPLOY_HOOK_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    await expect(triggerDeploy('save offer')).resolves.toEqual({
      status: 'skipped',
      message: 'VERCEL_DEPLOY_HOOK_URL is not configured.',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reports triggered only for a successful HTTP response', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.test/deploy';
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(triggerDeploy('publish offer')).resolves.toEqual({
      status: 'triggered',
      httpStatus: 201,
    });
    expect(fetchSpy).toHaveBeenCalledWith('https://api.vercel.test/deploy', { method: 'POST' });
  });

  it('reports failed for a non-2xx HTTP response', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.test/deploy';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(triggerDeploy('publish offer')).resolves.toEqual({
      status: 'failed',
      httpStatus: 500,
      message: 'Deploy hook returned HTTP 500.',
    });
  });

  it('reports failed when the request throws', async () => {
    process.env.VERCEL_DEPLOY_HOOK_URL = 'https://api.vercel.test/deploy';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    await expect(triggerDeploy('publish offer')).resolves.toEqual({
      status: 'failed',
      message: 'network down',
    });
  });
});

describe('shouldTriggerDeployForVisibility', () => {
  it.each([
    ['draft', 'published', true],
    ['archived', 'published', true],
    ['published', 'draft', true],
    ['published', 'archived', true],
    ['draft', 'archived', false],
    ['archived', 'draft', false],
  ])('%s → %s returns %s', (before, after, expected) => {
    expect(shouldTriggerDeployForVisibility(before, after)).toBe(expected);
  });
});
