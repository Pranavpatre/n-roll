# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Run tests once (Vitest)
npm run test:watch # Vitest in watch mode
```

To run a single test file:
```bash
npx vitest run src/test/example.test.ts
```

Supabase Edge Functions are in `supabase/functions/` and are deployed via the Supabase CLI. They run on Deno, not Node, so use Deno-compatible imports (`https://deno.land/std/...`, `https://esm.sh/...`).

## Architecture

n-roll is an AI digest reader (Inshorts-style) — users scroll through full-screen cards summarizing AI news, podcasts, and articles.

### Data flow

1. **Feeds** — admins add RSS/YouTube/Gmail feed URLs via `/admin`. YouTube URLs are converted to RSS by the `youtube-to-rss` edge function. Gmail newsletter feeds are stored as `gmail:<domain>`. Suggested sources (Substack, ArXiv, Reddit, HN, news RSS) can be one-click added.

2. **Fetch** — the `fetch-rss` edge function reads all active feeds for the user, fetches RSS XML, filters items to AI-related content (keyword list in the function), and returns new items not already in `digests`. ArXiv and HN feeds skip the AI filter (already pre-filtered). Max 30 items per feed.

3. **Summarize** — the `summarize` edge function calls the Anthropic Claude API (`claude-haiku-4-5-20251001`) to produce structured JSON: topic, 3–5 key points, optional quote/guest/author. Results are stored in two tables: `digests` (one row per article) and `digest_points` (one row per bullet point, with `sort_order`). Summarization runs in parallel batches of 5.

4. **Discover** — the `discover-youtube` edge function uses YouTube Data API v3 to search for AI-related channels and returns suggestions for the admin to add.

5. **Display** — `Index.tsx` fetches up to 200 digests + their points from Supabase, joins them client-side, and renders a vertical snap-scroll list of `DigestCard` components. Filter tabs: All, News, Podcasts, Articles. Auto-sync runs on page load with a 15-minute cooldown stored in `localStorage`.

### Supabase schema

- `feeds` — user's RSS/YouTube/Gmail feed sources (`type`: `news` | `podcast` | `article` | `newsletter` | `youtube`)
- `digests` — one row per summarized article (`type`: `news` | `podcast` | `article` | `newsletter` | `youtube` | `x`)
- `digest_points` — bullet points for each digest, ordered by `sort_order`
- `user_roles` — RBAC with `app_role` enum (`admin` | `user`); checked via `has_role()` DB function

### Auth & roles

- `useAuth` — wraps Supabase auth state, provides `user`, `session`, `signOut`
- `useAdmin` — queries `user_roles` for the `admin` role; gates the `/admin` route via `AdminRoute`
- Gmail OAuth uses a direct Google OAuth popup (not Supabase's provider flow); the access token is passed manually to edge functions as `providerToken`

### Key environment variables (Supabase secrets)

- `ANTHROPIC_API_KEY` — required by the `summarize` function for Claude API
- `YOUTUBE_API_KEY` — required by the `discover-youtube` function
- Standard Supabase vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`

### Path alias

`@/` maps to `src/` (configured in Vite and TypeScript).
