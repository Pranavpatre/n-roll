

# Import X Following List via Twitter API

## Overview
Store the Twitter API credentials as secrets, create an edge function to fetch your X following list using the Bearer token, and bulk-import all handles as feeds.

## Steps

### 1. Store Twitter API secrets
Add three secrets:
- `TWITTER_CONSUMER_KEY` → `v9UltldFPn9FyZsieiE4aMTYl`
- `TWITTER_CONSUMER_SECRET` → `ie0ZT2bL9oObZddrjRM3BoDxPGN0GrMEiJirH0QYGZiEGYgLGY`
- `TWITTER_BEARER_TOKEN` → the Bearer token you provided

### 2. Create `fetch-x-following` edge function
- Uses the Bearer token (App-Only auth) to call `GET https://api.x.com/2/users/by/username/{username}` to get your user ID, then `GET https://api.x.com/2/users/{id}/following` with pagination
- Returns a list of handles and display names
- Requires your X username as input (or we can hardcode it)

**Note:** App-Only Bearer token can only fetch following lists of **public** profiles. If your profile is private, we'd need OAuth 1.0a user-context auth with access tokens instead.

### 3. Bulk-import handles as feeds
The edge function will:
- Query existing feeds for the user to skip duplicates
- Insert new feeds with `url: "x:{handle}"`, `type: "news"`, `name: "@{displayName}"`
- Return count of imported vs skipped

### 4. Add "Import X Following" button to Admin page
- New button in the feeds management section
- Prompts for X username (or uses a stored one)
- Calls the edge function, shows progress toast, refreshes feed list

### 5. Update `supabase/config.toml`
Add `[functions.fetch-x-following]` with `verify_jwt = false`

## Technical Details

- **API endpoint**: `https://api.x.com/2/users/{id}/following` — max 1000 per page, paginated via `pagination_token`
- **Rate limit**: 15 requests per 15 minutes (Bearer token)
- **Auth method**: Bearer token in `Authorization` header — simplest approach, no OAuth signature needed

