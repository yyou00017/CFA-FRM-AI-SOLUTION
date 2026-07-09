# HarborQuant

HarborQuant is a CFA and FRM practice-question generator built with Vite, React, TypeScript, Tailwind CSS, and a Vercel Serverless API.

## Features

- Generate original CFA and FRM practice questions from a user-entered concept.
- Support CFA Level I/II/III and FRM Part I/II.
- Return detailed solutions, knowledge analysis, and exam-logic insights.
- Save local practice history in the browser.
- Diagnose performance across six cognitive dimensions.
- Use a local backup generator when Gemini is unavailable, so testing does not fail silently.

## Local Development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY`.

3. Start the local app:

   ```bash
   npm run dev
   ```

## Vercel Deployment

Add these environment variables in Vercel Project Settings:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, defaults to `gemini-2.5-flash`)

The frontend calls `/api/generate-questions`, which is implemented by `api/generate-questions.ts`.

## SaaS Setup: Shopify + Supabase + Vercel

HarborQuant uses Shopify as the public storefront and checkout, while the Vercel app owns user accounts, credits, subscriptions, and question generation.

### 1. Create Supabase tables

Create a Supabase project, open the SQL editor, and run the SQL in:

```text
supabase/schema.sql
```

The schema creates:

- `profiles`: one row per HarborQuant user, including plan and credits.
- `billing_entitlements`: Shopify purchase records keyed by customer email.
- `usage_events`: question generation usage log.

### 2. Configure Vercel environment variables

Add these in Vercel Project Settings:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SHOPIFY_WEBHOOK_SECRET=
FREE_QUESTION_CREDITS=20
CORE_MONTHLY_CREDITS=300
PRO_MONTHLY_CREDITS=1500
ELITE_MONTHLY_CREDITS=5000
```

Keep `SUPABASE_SERVICE_ROLE_KEY` private. It must never be exposed in frontend code.

### 3. Connect Shopify webhook

In Shopify Admin, create a webhook for order payment/order creation events pointing to:

```text
https://your-vercel-domain.com/api/shopify-webhook
```

Use the Shopify webhook signing secret as `SHOPIFY_WEBHOOK_SECRET` in Vercel.

### 4. User flow

1. User visits Shopify storefront.
2. User starts a free HarborQuant account.
3. Free account receives `FREE_QUESTION_CREDITS`.
4. Question generation deducts one credit per generated question.
5. User buys a Shopify product.
6. Shopify webhook records an entitlement by email.
7. On next HarborQuant login/profile refresh, the user is upgraded automatically.
