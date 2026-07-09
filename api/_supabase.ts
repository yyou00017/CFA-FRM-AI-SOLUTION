type SupabaseUser = {
  id: string;
  email?: string;
};

export type BillingProfile = {
  user_id: string;
  email: string;
  plan: string;
  credits_remaining: number;
  monthly_credit_limit: number;
  shopify_customer_id?: string | null;
  updated_at?: string;
};

const DEFAULT_FREE_CREDITS = Number(process.env.FREE_QUESTION_CREDITS || 20);

function supabaseUrl() {
  return process.env.SUPABASE_URL?.replace(/\/$/, "");
}

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl() && serviceKey());
}

function headers(extra?: Record<string, string>) {
  const key = serviceKey();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function supabaseFetch(path: string, init?: RequestInit) {
  const base = supabaseUrl();
  if (!base) throw new Error("SUPABASE_URL is not configured.");
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

export function getBearerToken(req: any) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length).trim();
}

export async function verifySupabaseUser(token: string): Promise<SupabaseUser | null> {
  const base = supabaseUrl();
  const anonOrServiceKey = process.env.SUPABASE_ANON_KEY || serviceKey();
  if (!base || !anonOrServiceKey || !token) return null;
  const response = await fetch(`${base}/auth/v1/user`, {
    headers: {
      apikey: anonOrServiceKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function findEntitlement(email: string) {
  const encoded = encodeURIComponent(email.toLowerCase());
  const rows = await supabaseFetch(
    `/rest/v1/billing_entitlements?email=eq.${encoded}&status=eq.active&select=*&order=created_at.desc&limit=1`,
    { headers: headers() }
  );
  return Array.isArray(rows) ? rows[0] : null;
}

function planCredits(plan: string) {
  if (plan === "elite") return Number(process.env.ELITE_MONTHLY_CREDITS || 5000);
  if (plan === "pro") return Number(process.env.PRO_MONTHLY_CREDITS || 1500);
  if (plan === "core") return Number(process.env.CORE_MONTHLY_CREDITS || 300);
  return DEFAULT_FREE_CREDITS;
}

export async function getOrCreateProfile(user: SupabaseUser): Promise<BillingProfile> {
  const email = (user.email || "").toLowerCase();
  const existing = await supabaseFetch(`/rest/v1/profiles?user_id=eq.${user.id}&select=*&limit=1`, {
    headers: headers(),
  });
  const current = Array.isArray(existing) ? existing[0] : null;

  const entitlement = email ? await findEntitlement(email) : null;
  const entitlementPlan = entitlement?.plan as string | undefined;
  const targetPlan = entitlementPlan || current?.plan || "free";
  const targetLimit = planCredits(targetPlan);
  const currentCredits = Number(current?.credits_remaining ?? DEFAULT_FREE_CREDITS);
  const targetCredits =
    current && current.plan === targetPlan ? currentCredits : Math.max(currentCredits, targetLimit);

  const payload: BillingProfile = {
    user_id: user.id,
    email,
    plan: targetPlan,
    credits_remaining: targetCredits,
    monthly_credit_limit: targetLimit,
    shopify_customer_id: entitlement?.shopify_customer_id || current?.shopify_customer_id || null,
    updated_at: new Date().toISOString(),
  };

  const rows = await supabaseFetch("/rest/v1/profiles?on_conflict=user_id&select=*", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(payload),
  });

  return Array.isArray(rows) ? rows[0] : payload;
}

export async function consumeCredits(user: SupabaseUser, amount: number, metadata: Record<string, unknown>) {
  if (!hasSupabaseConfig()) {
    return { enforced: false, profile: null as BillingProfile | null };
  }

  const profile = await getOrCreateProfile(user);
  const nextCredits = profile.credits_remaining - amount;
  if (nextCredits < 0) {
    return { enforced: true, profile, insufficient: true };
  }

  const rows = await supabaseFetch(`/rest/v1/profiles?user_id=eq.${user.id}&select=*`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      credits_remaining: nextCredits,
      updated_at: new Date().toISOString(),
    }),
  });

  await supabaseFetch("/rest/v1/usage_events", {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      user_id: user.id,
      event_type: "question_generation",
      amount,
      metadata,
    }),
  });

  return { enforced: true, profile: Array.isArray(rows) ? rows[0] : { ...profile, credits_remaining: nextCredits } };
}

export async function refundCredits(user: SupabaseUser, amount: number) {
  if (!hasSupabaseConfig()) return;
  const profile = await getOrCreateProfile(user);
  await supabaseFetch(`/rest/v1/profiles?user_id=eq.${user.id}`, {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({
      credits_remaining: profile.credits_remaining + amount,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function recordShopifyEntitlement(input: {
  email: string;
  plan: string;
  credits: number;
  status: string;
  shopifyOrderId?: string;
  shopifyCustomerId?: string;
  raw: unknown;
}) {
  return supabaseFetch("/rest/v1/billing_entitlements?on_conflict=shopify_order_id&select=*", {
    method: "POST",
    headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      email: input.email.toLowerCase(),
      plan: input.plan,
      credits: input.credits,
      status: input.status,
      shopify_order_id: input.shopifyOrderId || null,
      shopify_customer_id: input.shopifyCustomerId || null,
      raw: input.raw,
    }),
  });
}
