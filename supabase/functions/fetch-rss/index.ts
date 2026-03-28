import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Strong signals — these are unambiguous AI terms, safe for title-only matching
const AI_KEYWORDS_STRONG = [
  // Core concepts
  "artificial intelligence", "machine learning", "deep learning", "neural network",
  "large language model", "llm", "generative ai", "gen ai", "genai",
  // Frontier models & products
  "chatgpt", "gpt-4", "gpt-5", "gpt4", "gpt5", "gpt-4o", "gpt-o1", "gpt-o3",
  "claude 3", "claude 4", "claude sonnet", "claude opus", "claude haiku",
  "gemini 2", "gemini 3", "gemini pro", "gemini ultra",
  "deepseek", "qwen", "phi-4", "llama 3", "llama 4",
  "grok", "grok-2", "grok-3",
  // Companies (unambiguous)
  "openai", "anthropic", "deepmind", "google deepmind",
  "mistral ai", "cohere", "inflection ai", "character ai",
  "stability ai", "xai", "groq",
  // AI products & tools
  "chatgpt", "copilot github", "github copilot",
  "midjourney", "stable diffusion", "dall-e", "dalle",
  "sora", "runway gen", "pika labs", "kling ai", "luma ai", "flux ai",
  "ideogram", "suno ai", "udio",
  "perplexity ai", "cursor ai", "windsurf ai", "devin ai", "replit ai",
  "elevenlabs", "eleven labs",
  "hugging face", "huggingface",
  "notion ai", "adobe firefly",
  // Technical
  "transformer", "diffusion model", "fine-tuning", "fine tuning",
  "prompt engineering", "retrieval augmented", "vector database",
  "reinforcement learning", "rlhf", "chain of thought",
  "multimodal", "multi-modal", "text-to-image", "text-to-video",
  "text-to-speech", "speech-to-text",
  "ai agent", "ai agents", "agentic",
  "ai safety", "ai alignment", "ai ethics", "ai regulation",
  "ai chip", "ai hardware", "tpu", "nvidia ai",
  "foundation model", "frontier model", "open source ai", "open-source ai",
  "natural language processing", "computer vision",
  "model context protocol", "mcp server",
  // AI in context
  "ai tool", "ai tools", "ai app", "ai startup", "ai company",
  "ai model", "ai research", "ai benchmark", "ai assistant",
  "ai video", "ai image", "ai music", "ai code", "ai coding",
  "ai search", "ai chatbot", "ai bot",
];

// Weak signals — only match when combined with description context (not title-only)
const AI_KEYWORDS_WEAK = [
  "gpt", "claude", "gemini", "mistral", "llama", "copilot",
  "nvidia", "meta ai", "google ai", "microsoft ai", "amazon ai", "apple ai",
  "embedding", "tokenizer", "inference", "training data",
  "robotics", "humanoid", "autonomous driving", "self-driving",
  "databricks", "snowflake cortex",
  "runway", "pika", "kling",
  "nlp", "vision model",
];

const ACTION_KEYWORDS = [
  "launching", "launched", "announcing", "announced", "introducing", "introduced",
  "now available", "rolling out", "just shipped", "new release",
  "beta", "early access", "waitlist", "api access", "open source",
];

const AI_CONTEXT_WORDS = [
  "ai", "artificial intelligence", "machine learning", "ml", "llm", "model",
  "gpt", "claude", "gemini", "neural", "deep learning", "generative",
  "agent", "copilot", "chatbot", "diffusion",
];

function isAIRelated(title: string, description: string, titleOnly = false): boolean {
  const titleLower = title.toLowerCase();
  const fullText = `${title} ${description}`.toLowerCase();

  // Strong keywords are unambiguous — safe to match in title alone
  if (AI_KEYWORDS_STRONG.some((kw) => titleLower.includes(kw))) return true;

  // For podcasts/YouTube, stop here — descriptions contain sponsor links
  // that falsely match AI keywords (e.g., Perplexity ads in every Lex Fridman video)
  if (titleOnly) return false;

  // Weak keywords need description context to confirm AI relevance
  if (AI_KEYWORDS_WEAK.some((kw) => fullText.includes(kw))) return true;

  // Action + AI context combo (e.g., "launching" + "model")
  const hasAction = ACTION_KEYWORDS.some((kw) => fullText.includes(kw));
  const hasAIContext = AI_CONTEXT_WORDS.some((kw) => fullText.includes(kw));
  return hasAction && hasAIContext;
}

function extractItems(xml: string) {
  const items: { title: string; link: string; description: string; pubDate: string }[] = [];
  const itemRegex = /<(?:item|entry)[\s>]([\s\S]*?)<\/(?:item|entry)>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    const link = block.match(/<link[^>]*href="([^"]*)"/) ?.[1] ||
                 block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1]?.trim() || "";
    const description = block.match(/<(?:description|media:description|content)[^>]*>([\s\S]*?)<\/(?:description|media:description|content)>/i)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || "";
    const pubDate = block.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i)?.[1]?.trim() || "";
    items.push({ title, link, description, pubDate });
  }
  return items;
}

// Normalize a title for similarity comparison: lowercase, strip punctuation, extra spaces
function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

// Check if a title is too similar to any seen title (word overlap > 60%)
function isTitleDuplicate(normalized: string, seenTitles: string[]): boolean {
  const words = new Set(normalized.split(" ").filter((w) => w.length > 2));
  if (words.size < 3) return false;
  for (const seen of seenTitles) {
    const seenWords = new Set(seen.split(" ").filter((w) => w.length > 2));
    if (seenWords.size < 3) continue;
    let overlap = 0;
    for (const w of words) {
      if (seenWords.has(w)) overlap++;
    }
    const similarity = overlap / Math.min(words.size, seenWords.size);
    if (similarity > 0.6) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Parse body early for providerToken
  let requestBody: any = {};
  try { requestBody = await req.json(); } catch {}

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const { data: feeds, error: feedsError } = await supabase
      .from("feeds")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);

    if (feedsError) throw feedsError;
    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingDigests } = await supabase
      .from("digests")
      .select("url, title")
      .eq("user_id", userId);
    const existingUrls = new Set((existingDigests || []).map((d: any) => d.url));
    const existingTitles = (existingDigests || []).map((d: any) => normalizeTitle(d.title));

    // 1-month lookback window
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allItems: any[] = [];
    const seenTitles: string[] = [...existingTitles];

    // Separate feeds by source type
    const rssFeeds = feeds.filter((f: any) => !f.url.startsWith("gmail:"));
    const gmailFeeds = feeds.filter((f: any) => f.url.startsWith("gmail:"));

    // Process RSS/YouTube feeds
    for (const feed of rssFeeds) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "AIBuzz/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const items = extractItems(xml);

        const skipAIFilter = feed.url.includes("arxiv.org") || feed.url.includes("hnrss.org");
        let added = 0;
        for (const item of items) {
          if (added >= 30) break;
          if (!item.link || item.link.length < 10) continue;
          if (existingUrls.has(item.link)) continue;
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          if (pubDate < cutoff) continue;

          const titleOnly = feed.type === "podcast";
          if (!skipAIFilter && !isAIRelated(item.title, item.description, titleOnly)) {
            console.log(`Skipped (not AI-related): ${item.title}`);
            continue;
          }

          // Title similarity dedup — skip stories covering the same topic
          const normalized = normalizeTitle(item.title);
          if (isTitleDuplicate(normalized, seenTitles)) {
            console.log(`Skipped (duplicate topic): ${item.title}`);
            continue;
          }
          seenTitles.push(normalized);

          allItems.push({
            feedId: feed.id,
            feedName: feed.name,
            feedType: feed.type,
            title: item.title,
            link: item.link,
            description: item.description.slice(0, 2000),
            pubDate: pubDate.toISOString(),
          });
          added++;
        }
      } catch (e) {
        console.error(`Error fetching ${feed.url}:`, e);
      }
    }

    // Process Gmail newsletter feeds (requires providerToken from request body)
    if (gmailFeeds.length > 0) {
      const providerToken = requestBody?.providerToken || null;
      if (providerToken) {
        try {
          const gmailDomains = gmailFeeds.map((f: any) => ({
            feedId: f.id,
            feedName: f.name,
            domain: f.url.replace("gmail:", ""),
          }));

          const gmailRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-gmail-content`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              providerToken,
              domains: gmailDomains,
              existingUrls: Array.from(existingUrls),
            }),
          });

          if (gmailRes.ok) {
            const gmailData = await gmailRes.json();
            const gmailItems = gmailData?.items || [];
            allItems.push(...gmailItems);
            console.log(`Added ${gmailItems.length} items from Gmail newsletters`);
          } else {
            console.error(`fetch-gmail-content failed: ${gmailRes.status}`);
          }
        } catch (e) {
          console.error("Error fetching Gmail content:", e);
        }
      } else {
        console.log(`Skipping ${gmailFeeds.length} Gmail feeds — no provider token`);
      }
    }

    console.log(`Total AI-related items found: ${allItems.length}`);

    return new Response(JSON.stringify({ items: allItems, hasGmailFeeds: gmailFeeds.length > 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-rss error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
