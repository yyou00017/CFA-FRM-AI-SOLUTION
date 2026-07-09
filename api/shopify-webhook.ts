import crypto from "crypto";
import { recordShopifyEntitlement } from "./_supabase";

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function verifyShopifyHmac(rawBody: Buffer, hmacHeader: string | undefined) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!hmacHeader) return false;
  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  if (Buffer.byteLength(digest) !== Buffer.byteLength(hmacHeader)) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));
}

function inferPlan(lineItems: any[]) {
  const text = lineItems.map((item) => `${item.title || ""} ${item.name || ""}`).join(" ").toLowerCase();
  if (text.includes("elite")) return "elite";
  if (text.includes("pro") || text.includes("frm") || text.includes("cfa adaptive")) return "pro";
  if (text.includes("core") || text.includes("founding")) return "core";
  return "core";
}

function planCredits(plan: string) {
  if (plan === "elite") return Number(process.env.ELITE_MONTHLY_CREDITS || 5000);
  if (plan === "pro") return Number(process.env.PRO_MONTHLY_CREDITS || 1500);
  if (plan === "core") return Number(process.env.CORE_MONTHLY_CREDITS || 300);
  return Number(process.env.FREE_QUESTION_CREDITS || 20);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const rawBody = await readRawBody(req);
  const hmac = req.headers["x-shopify-hmac-sha256"];
  if (!verifyShopifyHmac(rawBody, Array.isArray(hmac) ? hmac[0] : hmac)) {
    return res.status(401).json({ error: "Invalid Shopify webhook signature." });
  }

  const topic = String(req.headers["x-shopify-topic"] || "");
  const payload = JSON.parse(rawBody.toString("utf8"));
  const email = payload.email || payload.customer?.email;
  if (!email) return res.status(200).json({ ok: true, skipped: "No customer email on webhook." });

  const lineItems = Array.isArray(payload.line_items) ? payload.line_items : [];
  const plan = inferPlan(lineItems);
  const status = topic.includes("refund") || topic.includes("cancel") ? "inactive" : "active";

  await recordShopifyEntitlement({
    email,
    plan,
    credits: planCredits(plan),
    status,
    shopifyOrderId: payload.admin_graphql_api_id || String(payload.id || ""),
    shopifyCustomerId: payload.customer?.admin_graphql_api_id || String(payload.customer?.id || ""),
    raw: { topic, payload },
  });

  return res.status(200).json({ ok: true, email, plan, status });
}
