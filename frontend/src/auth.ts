export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  created_at: number;
};

export type AuthSession = {
  token: string;
  user: AuthUser;
};

const SESSION_KEY = "privacydrive-session";
export const CONTROL_API = (import.meta.env.VITE_CONTROL_API ?? "").replace(/\/+$/, "");

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${CONTROL_API}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const firstValidationError = Array.isArray(payload.detail) ? payload.detail[0]?.msg : undefined;
    const message = typeof payload.detail === "string"
      ? payload.detail
      : typeof firstValidationError === "string"
        ? firstValidationError.replace(/^Value error,\s*/i, "")
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function loadSession(): AuthSession | null {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) as AuthSession : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function registerAccount(name: string, email: string, password: string): Promise<AuthSession> {
  return authRequest<AuthSession>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function loginAccount(email: string, password: string): Promise<AuthSession> {
  return authRequest<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function verifySession(session: AuthSession): Promise<AuthSession> {
  const user = await authRequest<AuthUser>("/api/auth/me", {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  return { ...session, user };
}

export async function logoutAccount(token: string): Promise<void> {
  await authRequest<void>("/api/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

