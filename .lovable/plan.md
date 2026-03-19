

# Full-Fledged Daily Digest App

## Overview

Transform the current frontend shell into a working app with authentication, YouTube subscription syncing, RSS feed management, and AI-powered summarization -- all backed by Supabase Cloud.

## Architecture

```text
+------------------+     +-------------------+     +---------------------+
|   React Frontend | --> | Supabase Auth     | --> | Google OAuth        |
|   (SPA)          |     | (Email + Google)  |     | (YouTube API scope) |
+------------------+     +-------------------+     +---------------------+
        |                         |
        v                         v
+------------------+     +-------------------+
| Edge Functions   |     | Supabase DB       |
| - sync-youtube   |     | - profiles        |
| - fetch-rss      |     | - feeds           |
| - summarize      |     | - digests         |
+------------------+     | - digest_points   |
        |                 +-------------------+
        v
+------------------+
| Lovable AI       |
| (Summarization)  |
+------------------+
```

## Step-by-Step Plan

### 1. Authentication (Email + Google Sign-In)

- Create an Auth page (`/auth`) with email login/signup and Google sign-in button
- Google OAuth is configured with the `youtube.readonly` scope so we can access YouTube subscriptions after sign-in
- Create a protected layout that redirects unauthenticated users to `/auth`
- Store the Google OAuth provider token (needed for YouTube API calls) in the user session

**User action required:** Configure Google OAuth in the Supabase dashboard with YouTube Data API v3 scopes enabled in Google Cloud Console.

### 2. Database Schema

Create tables to persist feeds and digests per user:

- **feeds** -- `id`, `user_id`, `name`, `type` (podcast/newsletter), `url`, `active`, `created_at`
- **digests** -- `id`, `user_id`, `feed_id`, `title`, `source`, `guest`, `guest_bio`, `author`, `url`, `date`, `quote`, `type`, `created_at`
- **digest_points** -- `id`, `digest_id`, `heading`, `detail`, `sort_order`

All tables have RLS policies restricting access to the owning user.

### 3. YouTube Subscription Sync (Edge Function)

Create a `sync-youtube` edge function that:
- Receives the user's Google provider token from the frontend
- Calls YouTube Data API v3 `/subscriptions?mine=true` to list subscribed channels
- For each channel, attempts to find an RSS feed URL (YouTube channels have RSS feeds at `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`)
- Inserts new feeds into the `feeds` table for the user
- Returns the list of synced feeds

### 4. RSS Feed Fetching (Edge Function)

Create a `fetch-rss` edge function that:
- Reads the user's active feeds from the database
- Fetches each RSS feed URL and parses the XML to extract recent items (last 28 hours)
- Returns new items not yet in the digests table

### 5. AI Summarization (Edge Function)

Create a `summarize` edge function that:
- Takes a feed item (title, content/description, URL) as input
- Calls the Lovable AI Gateway (`google/gemini-3-flash-preview`) with a system prompt tuned for digest-style bullet summaries
- Returns structured summary data (key points with headings and details, optional quote)
- Handles rate limits (429) and payment errors (402) gracefully

### 6. Refresh Flow (Frontend)

Update the Refresh button to:
1. Call `fetch-rss` to discover new items across all feeds
2. For each new item, call `summarize` to generate a digest
3. Save results to the database
4. Re-fetch and display the updated digest list

### 7. Updated Frontend Pages

- **Auth page** (`/auth`): Email login/signup + "Sign in with Google" button
- **Dashboard** (`/`): Protected route showing the current digest feed, feed management, and a "Sync YouTube" button
- **Settings panel**: Manage connected accounts and feed preferences

### 8. Frontend Component Updates

- Refactor `Index.tsx` to load feeds/digests from Supabase instead of hardcoded arrays
- Add a "Sync YouTube Subscriptions" button in the Manage Feeds tab
- Show loading/progress states during sync and summarization
- Add logout functionality to the header

## Technical Notes

- **Lovable AI** is used for summarization (pre-configured `LOVABLE_API_KEY` secret). No additional API keys needed for AI.
- **Google OAuth** requires the user to configure credentials in the Supabase dashboard and Google Cloud Console. Instructions will be provided in-app.
- **YouTube RSS** feeds are publicly accessible -- no API key needed for fetching feed content, only for the initial subscription list sync.
- All edge functions include CORS headers and proper error handling.
- `config.toml` will have `verify_jwt = false` for edge functions that validate auth in code.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/Auth.tsx` | Create - login/signup page |
| `src/components/ProtectedRoute.tsx` | Create - auth guard |
| `src/integrations/supabase/client.ts` | Create - Supabase client |
| `src/hooks/useAuth.ts` | Create - auth state hook |
| `supabase/functions/sync-youtube/index.ts` | Create - YouTube sync |
| `supabase/functions/fetch-rss/index.ts` | Create - RSS fetcher |
| `supabase/functions/summarize/index.ts` | Create - AI summarizer |
| `supabase/config.toml` | Create - edge function config |
| `src/pages/Index.tsx` | Modify - use Supabase data |
| `src/components/FeedList.tsx` | Modify - add YouTube sync |
| `src/App.tsx` | Modify - add routes + auth |
| DB migration | Create tables + RLS policies |

