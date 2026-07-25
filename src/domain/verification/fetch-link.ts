import type { LinkObservation } from './link-check';

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

interface FetchLinkOptions {
  fetcher?: Fetcher;
  attempts?: number;
  timeoutMs?: number;
}

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function retryableStatus(status: number): boolean {
  return status === 408 || status >= 500;
}

/**
 * Fetch a link with one bounded retry for transient network, timeout and 5xx
 * failures. Deterministic failures (404) and bot blocks (403/429) return
 * immediately so the checker does not hammer providers.
 */
export async function fetchLinkWithRetry(
  url: string,
  options: FetchLinkOptions = {},
): Promise<LinkObservation> {
  const fetcher = options.fetcher ?? fetch;
  const attempts = Math.max(1, Math.trunc(options.attempts ?? 2));
  const timeoutMs = Math.max(1, Math.trunc(options.timeoutMs ?? 15_000));
  let last: LinkObservation = { status: 0, error: 'unknown fetch failure' };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const response = await fetcher(url, {
        method: 'GET',
        redirect: 'follow',
        signal: ctrl.signal,
        headers: {
          'user-agent': DEFAULT_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
      });
      last = {
        status: response.status,
        ...(response.url ? { finalUrl: response.url } : {}),
      };
      // The checker only needs status + final URL. Leaving response bodies
      // unread keeps Undici sockets alive and prevents the CLI from exiting.
      try {
        await response.body?.cancel();
      } catch {
        // Cleanup failure must not turn a valid HTTP result into a dead link.
      }
      if (!retryableStatus(response.status) || attempt === attempts) return last;
    } catch (error) {
      last = {
        status: 0,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'timeout'
            : error instanceof Error
              ? error.message
              : String(error),
      };
      if (attempt === attempts) return last;
    } finally {
      clearTimeout(timer);
    }
  }

  return last;
}
