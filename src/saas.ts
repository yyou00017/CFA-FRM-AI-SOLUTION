export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  email: string;
};

export type BillingProfile = {
  email: string;
  plan: string;
  credits_remaining: number;
  monthly_credit_limit: number;
};

const SESSION_KEY = "harborquant_session";

function supabaseUrl() {
  return import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
}

function anonKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY;
}

export function hasClientAuthConfig() {
  return Boolean(supabaseUrl() && anonKey());
}

function authHeaders(token?: string) {
  const key = anonKey();
  if (!key) throw new Error("Supabase public key is not configured.");
  return {
    apikey: key,
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function normalizeAuthResponse(data: any, fallbackEmail: string): AuthSession {
  const accessToken = data.access_token || data.session?.access_token;
  if (!accessToken) {
    throw new Error("Check your email to confirm the account, then sign in.");
  }
  return {
    accessToken,
    refreshToken: data.refresh_token || data.session?.refresh_token,
    email: data.user?.email || fallbackEmail,
  };
}

export async function signUp(email: string, password: string) {
  const base = supabaseUrl();
  if (!base) throw new Error("Supabase URL is not configured.");
  const response = await fetch(`${base}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || "Sign up failed.");
  return normalizeAuthResponse(data, email);
}

export async function signIn(email: string, password: string) {
  const base = supabaseUrl();
  if (!base) throw new Error("Supabase URL is not configured.");
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.msg || data.error_description || data.message || "Sign in failed.");
  return normalizeAuthResponse(data, email);
}

export async function fetchProfile(session: AuthSession | null) {
  const response = await fetch("/api/me", {
    headers: session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {},
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Unable to load profile.");
  return data.profile as BillingProfile;
}
