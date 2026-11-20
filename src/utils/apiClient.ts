import { handleLocalApiRequest } from './localQuizEngine.ts';

export interface SafeJsonResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

const TRANSIENT_STATUSES = new Set([502, 503, 504, 408, 429]);
const STATIC_HOST_STATUSES = new Set([0, 404, 405, 501]);

function looksLikeHtml(raw: string): boolean {
  const trimmed = raw.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function tryLocalFallback<T>(url: string, init?: RequestInit): SafeJsonResult<T> | null {
  if (!url.startsWith('/api/')) return null;
  const local = handleLocalApiRequest(url, init);
  if (!local.handled) return null;
  return {
    ok: local.ok,
    status: local.status,
    data: local.data as T,
    error: local.error,
  };
}

/**
 * Safely fetches an API endpoint and parses JSON without ever throwing
 * "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 * Automatically falls back to the local browser quiz engine when deployed
 * on static/CDN hosts (e.g. Cloudflare Pages/Workers static assets returning HTTP 405/404/HTML).
 */
export async function safeFetchJson<T = Record<string, unknown>>(
  url: string,
  init?: RequestInit
): Promise<SafeJsonResult<T>> {
  const attemptFetch = async (): Promise<SafeJsonResult<T>> => {
    try {
      const headers = new Headers(init?.headers || {});
      if (!headers.has('Accept')) {
        headers.set('Accept', 'application/json');
      }

      const res = await fetch(url, { ...init, headers });
      const raw = await res.text();
      const trimmed = raw.trim();

      // Static/Cloudflare deploy fallback: 405 Method Not Allowed, 404, 501, or SPA HTML shell returned for /api/*
      if (STATIC_HOST_STATUSES.has(res.status) || looksLikeHtml(trimmed)) {
        const local = tryLocalFallback<T>(url, init);
        if (local) return local;
      }

      if (!trimmed) {
        if (!res.ok) {
          const local = tryLocalFallback<T>(url, init);
          if (local) return local;
        }
        return {
          ok: false,
          status: res.status,
          data: null,
          error: res.ok
            ? 'Server returned an empty response. Please try again.'
            : `Server connection hiccup (HTTP ${res.status}). Please try again.`,
        };
      }

      if (looksLikeHtml(trimmed)) {
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'Quiz server is restarting or unavailable. Please try again.',
        };
      }

      let parsed: (T & { error?: string }) | null = null;
      try {
        parsed = JSON.parse(trimmed) as T & { error?: string };
      } catch {
        const local = tryLocalFallback<T>(url, init);
        if (local) return local;
        return {
          ok: false,
          status: res.status,
          data: null,
          error: 'Received an unexpected server response. Please try again.',
        };
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data: parsed,
          error: parsed?.error || `Request failed (HTTP ${res.status}).`,
        };
      }

      return {
        ok: true,
        status: res.status,
        data: parsed,
        error: null,
      };
    } catch {
      const local = tryLocalFallback<T>(url, init);
      if (local) return local;
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Network error while reaching the quiz server. Check your connection and try again.',
      };
    }
  };

  const first = await attemptFetch();
  if (!first.ok && TRANSIENT_STATUSES.has(first.status)) {
    await waitMs(250);
    return attemptFetch();
  }
  return first;
}
