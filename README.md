# Kensworth Institute of Finance

Kensworth is an independent CFA and FRM examination-preparation portal. It combines focused practice sets, worked rationales, saved assignments and a subject-by-subject candidate learning record.

## Product principles

- Present the service as a professional education institution, not a technology showcase.
- Keep the candidate’s work, curriculum coverage and review sequence at the centre of the experience.
- Use assessment language that candidates already understand: programme, assignment, rationale, subject standing and recommended next work.
- Keep the question-preparation service behind the product experience.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the required service settings.
3. Start the site with `npm run dev`.

## Deployment settings

The question bank uses `GEMINI_API_KEY` on the server. Candidate accounts and billing entitlements use Supabase and Shopify when their environment variables are configured. The service-role key must remain server-only.

## Trademark note

Kensworth Institute of Finance is an independent examination-preparation provider and is not affiliated with CFA Institute or GARP. CFA and FRM are trademarks of their respective owners.
