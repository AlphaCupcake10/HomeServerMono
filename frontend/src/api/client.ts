import type { ApiEnvelope, Session } from './types';

/** An error response from the API (or a network/parse failure), with the backend's details. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// --- Session store ---------------------------------------------------------------------------
// The access token lives only in memory; the refresh token is an httpOnly cookie the browser
// manages. AuthContext mirrors this store into React state.

type Listener = (session: Session | null) => void;
let session: Session | null = null;
const listeners = new Set<Listener>();

export const sessionStore = {
  get: (): Session | null => session,
  set: (next: Session | null): void => {
    session = next;
    listeners.forEach((listener) => listener(next));
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// --- Refresh ---------------------------------------------------------------------------------

let refreshInFlight: Promise<Session | null> | null = null;

const doRefresh = async (): Promise<Session | null> => {
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    const next = res.ok ? ((await res.json()) as { data: Session }).data : null;
    sessionStore.set(next);
    return next;
  } catch {
    // Network failure: keep the current session; the next request will try again.
    return session;
  }
};

/**
 * Rotates the refresh cookie and returns a new session (or null when signed out).
 * Calls are de-duplicated within this tab and serialised across tabs: the backend treats a
 * superseded refresh token as replay and revokes the session, so two concurrent refreshes with
 * the same cookie would log the user out.
 */
export const refreshSession = (): Promise<Session | null> => {
  refreshInFlight ??= (
    navigator.locks ? navigator.locks.request('home-server-auth-refresh', doRefresh) : doRefresh()
  ).finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

// --- Requests --------------------------------------------------------------------------------

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  /** Retry once after refreshing the session on 401 (off for login itself). */
  retryOnUnauthorized?: boolean;
}

const parse = async <T>(res: Response): Promise<T> => {
  let body: ApiEnvelope<T> | undefined;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      res.status,
      'BAD_RESPONSE',
      `Unexpected response from the server (${res.status})`,
    );
  }
  if (!res.ok || !body.success) {
    const error = !body.success ? body.error : undefined;
    throw new ApiError(
      res.status,
      error?.code ?? `HTTP_${res.status}`,
      error?.message ?? res.statusText,
      error?.details,
    );
  }
  return body.data;
};

/** Calls `/api{path}` and unwraps the `{ success, data }` envelope. Throws `ApiError`. */
export const api = async <T>(
  path: string,
  { method = 'GET', body, signal, retryOnUnauthorized = true }: RequestOptions = {},
): Promise<T> => {
  const send = () => {
    const token = sessionStore.get()?.accessToken;
    return fetch(`/api${path}`, {
      method,
      credentials: 'include',
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Is the API running?');
  }

  if (res.status === 401 && retryOnUnauthorized && sessionStore.get()) {
    // The access token expired: rotate the session once and retry.
    if (await refreshSession()) {
      res = await send();
    }
  }
  return parse<T>(res);
};
