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
};

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { params, headers, ...rest } = options;

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
      ...headers,
    },
    ...rest,
  });

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
