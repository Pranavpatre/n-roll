# AI Buzz — Product Requirements Document

## What is AI Buzz?

People trying to stay updated with AI are overwhelmed. Dozens of YouTube channels, newsletters, Substacks, news sites, Reddit threads, and ArXiv papers — all scattered across platforms. Most people miss important launches, breakthroughs, and tool releases simply because they can't keep up.

**AI Buzz** is a daily AI briefing app — think Inshorts, but for AI. It pulls content from 25+ sources, summarizes each item into a full-screen card with 3-5 key bullet points using Claude AI, and presents them in a fast vertical scroll. One place, one scroll, fully caught up.

---

## Core User Flow

1. Open app → see full-screen digest cards (snap-scroll)
2. Swipe/scroll through AI news, podcast summaries, and articles
3. Tap "Read article" / "Listen to episode" to go to the source
4. Done in 5-10 minutes

---

## Content Types

| Type | Sources | Example |
|------|---------|---------|
| **News** | Google News AI, TechCrunch AI, VentureBeat, Ars Technica, MIT Tech Review | "OpenAI releases GPT-5 with improved reasoning" |
| **Podcasts** | YouTube channels — All-In, No Priors, Fireship, Lex Fridman + all frontier AI company channels (OpenAI, Anthropic, Google DeepMind, etc.) | "Sam Altman discusses AGI timeline on Lex Fridman" |
| **Articles** | Substack blogs (Simon Willison, Ethan Mollick), ArXiv papers, Reddit (r/MachineLearning, r/LocalLLaMA), Hacker News AI feed | "New research shows chain-of-thought improves small model performance" |

---

## Features

### For Users

- **Snap-scroll digest feed** — Full-screen cards, one per item. Swipe to read next.
- **Filter tabs** — All / News / Podcasts / Articles
- **Auto-sync** — Fetches and summarizes new content on page load (15-min cooldown)
- **Source links** — Every card links to the original article, video, or paper
- **Progress indicator** — Shows current position (e.g., "12 / 47")

### For Admins

- **Feed management** — Add/remove RSS feeds, YouTube channels, Gmail newsletters
- **Suggested sources** — One-click add from 17 curated AI sources across 5 categories
- **YouTube channel discovery** — Search YouTube Data API for AI channels, add with one click
- **Gmail newsletter scan** — Connect Gmail to find AI newsletters you're subscribed to
- **Manual refresh** — Force fetch + summarize with progress feedback
- **Digest management** — View and delete individual summaries

---

## Summarization Pipeline

```
Feeds (RSS/YouTube/Gmail)
    ↓
fetch-rss (edge function)
    → Fetch XML from all active feeds
    → Filter by 140+ AI keywords
    → Deduplicate against existing digests
    → Max 30 items per feed, 30-day lookback
    ↓
summarize (edge function)
    → Claude Haiku (claude-haiku-4-5)
    → Generates: headline, 3-5 bullet points, optional quote/guest/author
    → Validates headline quality (rejects vague/editorial topics)
    → Parallel batches of 5
    ↓
Display (React snap-scroll)
    → Up to 200 digests
    → Filter by type
    → Link to original source
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password) |
| Edge Functions | Deno (Supabase Edge Functions) |
| AI | Claude Haiku (Anthropic API) |
| APIs | YouTube Data API v3, Gmail API |
| Analytics | Vercel Analytics |
| Hosting | Vercel |

---

## Database Schema

- **feeds** — RSS/YouTube/Gmail feed sources per user
- **digests** — One row per summarized item (title, source, url, type, guest, author, quote)
- **digest_points** — Bullet points per digest (heading, detail, sort_order)
- **user_roles** — RBAC (admin/user)

---

## Access Control

| Role | Can do |
|------|--------|
| **User** | View digests, filter, auto-sync, read sources |
| **Admin** | Everything above + manage feeds, refresh, discover channels, scan Gmail, delete digests |

---

## Content Sources (Pre-configured)

### Podcasts (25 YouTube channels)
**Frontier AI companies:** Google DeepMind, OpenAI, Anthropic, Mistral, ElevenLabs, Meta AI, NVIDIA, Microsoft AI, Stability AI, Runway, Perplexity

**AI commentary:** Fireship, Two Minute Papers, Matthew Berman, The AI Grid, Matt Wolfe, AI Jason, Yannic Kilcher, AI Explained, bycloud, James Briggs

**Interviews & shows:** All-In Podcast, No Priors, Varun Mayya, Lex Fridman

### News (5 RSS feeds)
Google News AI, TechCrunch AI, VentureBeat AI, MIT Tech Review AI, Ars Technica AI

### Articles (12 RSS feeds)
**Substack:** Simon Willison, One Useful Thing, Import AI, Semi Analysis, The Batch

**Research:** ArXiv cs.AI, cs.LG, cs.CL

**Community:** Reddit r/MachineLearning, r/artificial, r/LocalLLaMA, Hacker News AI

---

## Key Metrics

- Daily active users
- Cards scrolled per session
- Source link click-through rate
- Time to "all caught up" screen
- Feed refresh frequency

---

## Future Considerations

- Twitter/X integration (type already in schema)
- Personalized AI keyword filtering per user
- Push notifications for breaking AI news
- Bookmarking / sharing individual digests
- Mobile app (React Native)
