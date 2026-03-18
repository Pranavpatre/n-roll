import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_KEYWORDS = [
  "artificial intelligence", "machine learning", "deep learning", "neural network",
  "large language model", "llm", "generative ai", "gen ai", "genai",
  "gpt", "chatgpt", "openai", "claude", "anthropic", "gemini", "mistral", "llama",
  "midjourney", "stable diffusion", "dall-e", "dalle", "sora", "copilot",
  "perplexity", "cursor", "devin", "lovable",
  "transformer", "diffusion model", "fine-tuning", "fine tuning", "finetuning",
  "prompt engineering", "rag ", "retrieval augmented", "vector database",
  "embedding", "tokenizer", "inference", "training data",
  "reinforcement learning", "rlhf", "chain of thought", "cot",
  "multimodal", "multi-modal", "vision model", "text-to-image", "text-to-video",
  "text-to-speech", "speech-to-text", "text to image", "text to video",
  "ai agent", "ai agents", "agentic", "autonomous agent", "ai assistant",
  "ai tool", "ai tools", "ai app", "ai startup", "ai company",
  "ai safety", "ai alignment", "ai ethics", "ai regulation", "ai policy",
  "ai chip", "ai hardware", "gpu", "nvidia", "tpu",
  "foundation model", "frontier model", "open source ai", "open-source ai",
  "ai research", "ai paper", "ai benchmark", "ai model",
  "natural language processing", "nlp", "computer vision",
  "robotics", "humanoid", "autonomous driving", "self-driving",
];

function isAIRelated(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return AI_KEYWORDS.some((kw) => text.includes(kw));
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub;

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
      .select("url")
      .eq("user_id", userId);
    const existingUrls = new Set((existingDigests || []).map((d: any) => d.url));

    // 1-month lookback window
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const allItems: any[] = [];

    // Separate feeds by source type
    const rssFeeds = feeds.filter((f: any) => !f.url.startsWith("x:"));
    const xFeeds = feeds.filter((f: any) => f.url.startsWith("x:"));

    // Process RSS/YouTube feeds
    for (const feed of rssFeeds) {
      try {
        const res = await fetch(feed.url, {
          headers: { "User-Agent": "DailyDigest/1.0" },
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) continue;
        const xml = await res.text();
        const items = extractItems(xml);

        let added = 0;
        for (const item of items) {
          if (added >= 10) break;
          if (existingUrls.has(item.link)) continue;
          const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
          if (pubDate < cutoff) continue;

          if (!isAIRelated(item.title, item.description)) {
            console.log(`Skipped (not AI-related): ${item.title}`);
            continue;
          }

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

    // Process X/Twitter feeds via fetch-x function
    for (const feed of xFeeds) {
      try {
        const handle = feed.url.replace("x:", "");
        console.log(`Fetching X content for ${handle}`);

        const xRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fetch-x`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({ handle }),
        });

        if (!xRes.ok) {
          console.error(`fetch-x failed for ${handle}: ${xRes.status}`);
          continue;
        }

        const xData = await xRes.json();
        const xItems = xData?.items || [];

        for (const item of xItems) {
          if (existingUrls.has(item.link)) continue;
          allItems.push({
            feedId: feed.id,
            feedName: feed.name,
            feedType: feed.type,
            title: item.title,
            link: item.link,
            description: item.description.slice(0, 2000),
            pubDate: item.pubDate || new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error(`Error fetching X feed ${feed.url}:`, e);
      }
    }

    console.log(`Total AI-related items found: ${allItems.length}`);

    return new Response(JSON.stringify({ items: allItems }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-rss error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
