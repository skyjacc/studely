import { describe, expect, it, vi } from 'vitest';
import { fetchLinkWithRetry } from './fetch-link';

describe('fetchLinkWithRetry', () => {
  it('returns the first successful response without retrying', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 50 });
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('cancels the unused response body so keep-alive sockets can close', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const response = {
      status: 200,
      url: 'https://example.test/final',
      body: { cancel },
    } as unknown as Response;
    const fetcher = vi.fn().mockResolvedValue(response);

    await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 1, timeoutMs: 50 });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('keeps the HTTP result when response body cleanup fails', async () => {
    const response = {
      status: 200,
      url: 'https://example.test/final',
      body: { cancel: vi.fn().mockRejectedValue(new Error('already closed')) },
    } as unknown as Response;

    await expect(
      fetchLinkWithRetry('https://example.test', {
        fetcher: vi.fn().mockResolvedValue(response),
        attempts: 1,
        timeoutMs: 50,
      }),
    ).resolves.toEqual({ status: 200, finalUrl: 'https://example.test/final' });
  });

  it('retries a transient 5xx and returns the successful response', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 50 });
    expect(result.status).toBe(204);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('retries a thrown network error and returns the second result', async () => {
    const fetcher = vi.fn()
      .mockRejectedValueOnce(new Error('socket reset'))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 50 });
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('does not retry a deterministic 404 or bot-blocking 403', async () => {
    for (const status of [403, 404]) {
      const fetcher = vi.fn().mockResolvedValue(new Response(null, { status }));
      const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 50 });
      expect(result.status).toBe(status);
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });

  it('returns the final network error after all attempts', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'));
    const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 50 });
    expect(result).toEqual({ status: 0, error: 'network down' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('aborts a timed-out attempt and retries', async () => {
    const fetcher = vi.fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await fetchLinkWithRetry('https://example.test', { fetcher, attempts: 2, timeoutMs: 5 });
    expect(result.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
