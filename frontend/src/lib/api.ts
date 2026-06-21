/**
 * Thin fetch wrapper for talking to the FastAPI backend.
 *
 * - Reads the base URL from NEXT_PUBLIC_API_URL.
 * - Sends/receives JSON and includes credentials so the httpOnly refresh
 *   cookie flows on cross-origin auth requests.
 * - Throws a typed ApiError on non-2xx responses so callers can handle
 *   failures consistently.
 *
 * Works in both Server Components (SSR) and Client Components.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * In-memory access token (client only). Set by the auth store on login/refresh.
 * Never persisted — the refresh token lives in an httpOnly cookie and is used
 * to mint a new access token on page load. On the server this stays null.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/** Current in-memory access token (client only). Used by the assistant widget,
 * which streams via the AI SDK transport rather than apiFetch. */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Optional refresh handler. When a request 401s with a token present, apiFetch
 * calls this once to mint a fresh access token, then retries. Registered by the
 * auth store so api.ts stays free of auth imports (no cycle).
 */
type RefreshHandler = () => Promise<string | null>;
let refreshHandler: RefreshHandler | null = null;

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiFetchOptions = RequestInit & {
  /** Parsed and appended as a query string. */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** Internal: marks a request that has already retried after a refresh. */
  _isRetry?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { params, headers, _isRetry, ...rest } = options;

  let url = `${API_BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.append(key, String(value));
      }
    }
    const query = qs.toString();
    if (query) url += `?${query}`;
  }

  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    ...rest,
  });

  // Access token likely expired — refresh once and retry transparently.
  if (
    res.status === 401 &&
    accessToken &&
    refreshHandler &&
    !_isRetry &&
    !path.startsWith("/auth/")
  ) {
    const newToken = await refreshHandler();
    if (newToken) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
  }

  // 204 No Content — nothing to parse.
  if (res.status === 204) return undefined as T;

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const message =
      (isJson && (body?.detail || body?.message)) ||
      res.statusText ||
      "Request failed";
    throw new ApiError(res.status, String(message), body);
  }

  return body as T;
}
