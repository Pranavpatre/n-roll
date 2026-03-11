

## Pivot: Curated AI Digest (Remove Google Sign-In, Hide Feed Management)

### What Changes

The app becomes a **curated AI news digest** where you (the admin) manage all feeds behind the scenes, and end users simply sign in with email to read digests.

### 1. Auth Page -- Remove Google Sign-In

- Remove the Google OAuth button, the "or" divider, and the `handleGoogleSignIn` function from `Auth.tsx`
- Update tagline to "Your daily AI digest -- news, tools, podcasts & newsletters"

### 2. Index Page -- Remove User-Facing Feed Management

- Remove the "Manage Feeds" tab entirely (users don't see it)
- Remove the YouTube sync button and `handleSyncYouTube` logic
- Remove `AddFeedForm` import and usage
- Remove `FeedList` import and usage
- The digest tab becomes the only view -- a clean, read-only feed of curated content
- Update copy/branding: "Daily Digest" subtitle becomes "AI News, Tools, Podcasts & Newsletters"
- Keep the Refresh button (for you as admin, or remove if digests are auto-generated)

### 3. StatsBar -- Simplify

- Remove "Podcast Feeds" and "Newsletter Feeds" counts (users don't manage feeds)
- Show simpler stats: total digests, categories (news/podcasts/newsletters)

### 4. DigestCard -- Add "news" Type

- Extend the `type` field to include `"news"` alongside `"podcast"` and `"newsletter"`
- Add an icon/badge style for news items

### 5. Database -- Add "news" Type Support

- The `feeds.type` and `digests.type` columns currently accept text, so no migration needed -- just use `"news"` as a value

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Remove Google button, update branding |
| `src/pages/Index.tsx` | Remove Manage Feeds tab, YouTube sync, AddFeedForm; simplify to read-only digest view |
| `src/components/StatsBar.tsx` | Simplify stats for consumer view |
| `src/components/DigestCard.tsx` | Support "news" type with icon/badge |

No new files needed. No database migration required.

