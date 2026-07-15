const DEFAULT_BASE = "https://distaste-dimmer-starboard.ngrok-free.dev";

export function getApiBase(): string {
  const envBase =
    (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) ||
    (typeof process !== "undefined" && process.env?.API_BASE_URL);
  return (envBase as string) || DEFAULT_BASE;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("auth_token");
}

export function getUser(): { id: string; name: string; email: string; role: string } | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem("auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: unknown) {
  window.localStorage.setItem("auth_token", token);
  window.localStorage.setItem("auth_user", JSON.stringify(user));
}

export function clearAuth() {
  window.localStorage.removeItem("auth_token");
  window.localStorage.removeItem("auth_user");
}

export function getRoleRedirect(expected: "hr" | "candidate"): string | null {
  if (typeof window === "undefined") return null;
  const user = getUser();
  if (!user) return null;
  if (user.role === expected) return null;
  return user.role === "hr" ? "/dashboard" : "/jobs-browse";
}

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  form?: Record<string, string>;
  formData?: FormData;
  auth?: boolean;
  headers?: Record<string, string>;
};

export async function api<T = any>(path: string, opts: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, form, formData, auth = true, headers = {} } = opts;
  const h: Record<string, string> = { "ngrok-skip-browser-warning": "true", ...headers };
  let payload: BodyInit | undefined;

  if (formData) {
    payload = formData;
  } else if (form) {
    h["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(form).toString();
  } else if (body !== undefined) {
    h["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) h["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: h,
    body: payload,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      clearAuth();
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }
    const msg =
      (data && (data.detail || data.message || data.error)) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, typeof msg === "string" ? msg : JSON.stringify(msg), data);
  }

  return data as T;
}