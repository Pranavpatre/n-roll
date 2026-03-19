import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_KEYWORDS = [
  "artificial intelligence", "machine learning", "deep learning", "neural network",
  "large language model", "llm", "generative ai", "gen ai", "genai",
  "gpt", "chatgpt", "openai", "claude", "anthropic", "gemini", "mistral", "llama",
  "midjourney", "stable diffusion", "dall-e", "dalle", "sora", "copilot",
  "perplexity", "cursor", "devin", "lovable", "windsurf", "replit", "v0",
  "transformer", "diffusion model", "fine-tuning", "fine tuning", "finetuning",
  "prompt engineering", "rag ", "retrieval augmented", "vector database",
  "embedding", "tokenizer", "inference", "training data",
  "reinforcement learning", "rlhf", "chain of thought",
  "multimodal", "multi-modal", "vision model", "text-to-image", "text-to-video",
  "ai agent", "ai agents", "agentic", "autonomous agent", "ai assistant",
  "ai tool", "ai tools", "ai app", "ai startup", "ai company",
  "ai safety", "ai alignment", "ai ethics", "ai regulation", "ai policy",
  "ai chip", "ai hardware", "gpu", "nvidia", "tpu",
  "foundation model", "frontier model", "open source ai", "open-source ai",
  "ai research", "ai paper", "ai benchmark", "ai model",
  "natural language processing", "nlp", "computer vision",
  "robotics", "humanoid", "autonomous driving", "self-driving",
  "launching", "launched", "announcing", "announced", "introducing", "introduced",
  "now available", "rolling out", "just shipped", "new release", "open source",
  "beta", "early access", "waitlist", "api access",
  "dispatch", "artifacts", "projects", "computer use", "model context protocol", "mcp",
  "o1", "o3", "o4", "gpt-4", "gpt-5", "gpt4", "gpt5",
  "claude 3", "claude 4", "sonnet", "opus", "haiku",
  "gemini 2", "gemini 3", "flash", "deepseek", "qwen", "phi-4",
  "hugging face", "huggingface", "runway", "pika", "kling",
  "meta ai", "google ai", "microsoft ai", "amazon ai", "apple ai",
  "cohere", "databricks", "snowflake cortex", "groq",
];

function isAIRelated(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some((kw) => lower.includes(kw));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { handle } = await req.json();
    if (!handle) {
      return new Response(JSON.stringify({ error: "Missing handle" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanHandle = handle.replace(/^@/, "");
    console.log(`Searching for X posts from @${cleanHandle} via Firecrawl Search API`);

    // Primary search: recent posts from/about this handle
    const query = `"@${cleanHandle}" OR "${cleanHandle}" site:x.com OR site:twitter.com`;
    
    let items = await searchFirecrawl(apiKey, query, cleanHandle);

    // Fallback: broader search if no results
    if (items.length === 0) {
      console.log(`No results from primary search, trying broader query for @${cleanHandle}`);
      const fallbackQuery = `${cleanHandle} AI announcement OR launch OR release`;
      items = await searchFirecrawl(apiKey, fallbackQuery, cleanHandle);
    }

    console.log(`Found ${items.length} AI-related items from @${cleanHandle}`);

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-x error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function searchFirecrawl(
  apiKey: string,
  query: string,
  handle: string,
): Promise<{ title: string; link: string; description: string; pubDate: string }[]> {
  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 20,
      tbs: "qdr:m",
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!response.ok) {
    const errData = await response.text();
    console.error("Firecrawl search error:", response.status, errData);
    return [];
  }

  const data = await response.json();
  const results = data?.data || [];
  const items: { title: string; link: string; description: string; pubDate: string }[] = [];

  for (const result of results) {
    if (items.length >= 10) break;

    const title = result.title || "";
    const description = result.description || result.markdown?.slice(0, 2000) || "";
    const link = result.url || "";
    const combined = `${title} ${description}`;

    if (!isAIRelated(combined)) continue;

    items.push({
      title: title.slice(0, 200) || `Post by @${handle}`,
      link,
      description: description.slice(0, 2000),
      pubDate: new Date().toISOString(),
    });
  }

  return items;
}
