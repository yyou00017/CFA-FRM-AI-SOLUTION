# ExamLogic AI

ExamLogic AI is a CFA and FRM practice-question generator built with Vite, React, TypeScript, Tailwind CSS, and a Vercel Serverless API.

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
