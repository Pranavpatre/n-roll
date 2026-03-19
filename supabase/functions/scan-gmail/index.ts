import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Known AI newsletter RSS feeds mapped by sender domain/name
const KNOWN_NEWSLETTER_RSS: Record<string, { name: string; rss: string }> = {
  "bensbites.com": { name: "Ben's Bites", rss: "https://bensbites.beehiiv.com/feed" },
  "bensbites.beehiiv.com": { name: "Ben's Bites", rss: "https://bensbites.beehiiv.com/feed" },
  "therundown.ai": { name: "The Rundown AI", rss: "https://www.therundown.ai/feed" },
  "tldrnewsletter.com": { name: "TLDR AI", rss: "https://tldr.tech/ai/rss" },
  "tldr.tech": { name: "TLDR AI", rss: "https://tldr.tech/ai/rss" },
  "importai.net": { name: "Import AI", rss: "https://importai.substack.com/feed" },
  "superhuman.ai": { name: "Superhuman AI", rss: "https://www.superhuman.ai/feed" },
  "aibreakfast.beehiiv.com": { name: "AI Breakfast", rss: "https://aibreakfast.beehiiv.com/feed" },
  "mindstream.news": { name: "Mindstream", rss: "https://mindstream.news/feed" },
  "alphasignal.ai": { name: "Alpha Signal", rss: "https://alphasignal.ai/feed" },
  "aitidbits.substack.com": { name: "AI Tidbits", rss: "https://aitidbits.substack.com/feed" },
  "lastweekin.ai": { name: "Last Week in AI", rss: "https://lastweekin.ai/feed" },
  "newsletter.theaiedge.io": { name: "The AI Edge", rss: "https://newsletter.theaiedge.io/feed" },
  "neuralbrief.com": { name: "Neural Brief", rss: "https://www.neuralbrief.com/feed" },
};

const AI_KEYWORDS = [
  "ai", "artificial intelligence", "machine learning", "deep learning",
  "llm", "gpt", "chatgpt", "claude", "gemini", "openai", "anthropic",
  "neural", "generative", "copilot", "midjourney", "stable diffusion",
  "prompt", "transformer", "diffusion", "embedding",
];

function isAINewsletter(from: string, subject: string): boolean {
  const text = `${from} ${subject}`.toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw));
}

function extractDomain(email: string): string {
  const match = email.match(/@([^>]+)/);
  return match ? match[1].toLowerCase().trim() : "";
}

function extractSenderName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.split("@")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { providerToken } = await req.json();
    if (!providerToken) {
      return new Response(JSON.stringify({ error: "Missing Google provider token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Search Gmail for newsletter-like emails (unsubscribe header is a strong signal)
    const queries = [
      "category:promotions newer_than:30d",
      "unsubscribe AI newer_than:30d",
      "unsubscribe newsletter artificial intelligence newer_than:30d",
    ];

    const seenDomains = new Set<string>();
    const newsletters: { name: string; domain: string; rss: string | null; sampleSubject: string }[] = [];

    for (const q of queries) {
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${providerToken}` },
      });

      if (!searchRes.ok) {
        const errText = await searchRes.text();
        console.error(`Gmail search failed (${searchRes.status}): ${errText}`);
        if (searchRes.status === 401 || searchRes.status === 403) {
          return new Response(JSON.stringify({ error: "Gmail access denied. Please reconnect with Gmail permissions." }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      const searchData = await searchRes.json();
      const messageIds = (searchData.messages || []).map((m: any) => m.id);

      // Fetch headers for each message (batch in parallel, max 10 at a time)
      for (let i = 0; i < messageIds.length; i += 10) {
        const batch = messageIds.slice(i, i + 10);
        const headerPromises = batch.map((id: string) =>
          fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`, {
            headers: { Authorization: `Bearer ${providerToken}` },
          }).then((r) => r.ok ? r.json() : null).catch(() => null)
        );

        const results = await Promise.all(headerPromises);

        for (const msg of results) {
          if (!msg?.payload?.headers) continue;

          const headers = msg.payload.headers;
          const from = headers.find((h: any) => h.name === "From")?.value || "";
          const subject = headers.find((h: any) => h.name === "Subject")?.value || "";
          const hasUnsubscribe = headers.some((h: any) => h.name === "List-Unsubscribe");

          if (!hasUnsubscribe) continue;

          const domain = extractDomain(from);
          if (!domain || seenDomains.has(domain)) continue;

          // Check if AI-related
          if (!isAINewsletter(from, subject)) continue;

          seenDomains.add(domain);

          const knownRss = KNOWN_NEWSLETTER_RSS[domain];
          newsletters.push({
            name: knownRss?.name || extractSenderName(from),
            domain,
            rss: knownRss?.rss || null,
            sampleSubject: subject,
          });
        }
      }
    }

    console.log(`Found ${newsletters.length} AI newsletters from Gmail`);

    return new Response(JSON.stringify({ newsletters }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-gmail error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
