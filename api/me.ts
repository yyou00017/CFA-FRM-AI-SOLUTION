import { getBearerToken, getOrCreateProfile, hasSupabaseConfig, verifySupabaseUser } from "./_supabase";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed. Use GET." });
  }

  if (!hasSupabaseConfig()) {
    return res.status(200).json({
      mode: "dev",
      profile: {
        email: "dev@harborquant.local",
        plan: "dev",
        credits_remaining: 999,
        monthly_credit_limit: 999,
      },
    });
  }

  const token = getBearerToken(req);
  const user = await verifySupabaseUser(token);
  if (!user?.id) return res.status(401).json({ error: "Please sign in to continue." });

  const profile = await getOrCreateProfile(user);
  return res.status(200).json({ mode: "live", profile });
}
