import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AI-related keywords for content filtering
const AI_KEYWORDS = [
  "artificial intelligence", "machine learning", "deep learning", "neural network",
  "large language model", "llm", "generative ai", "gen ai", "genai",
  "gpt", "chatgpt", "openai", "claude", "anthropic", "gemini", "mistral", "llama",
  "midjourney", "stable diffusion", "dall-e", "dalle", "sora", "copilot",
  "perplexity", "cursor", "devin", "lovable",
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

    // Clean handle
    const cleanHandle = handle.replace(/^@/, "");
    const profileUrl = `https://x.com/${cleanHandle}`;

    console.log(`Scraping X profile: ${profileUrl}`);

    // Use Firecrawl to scrape the X profile page
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: profileUrl,
        formats: ["markdown"],
        onlyMainContent: true,
        waitFor: 3000,
      }),
    });

    if (!response.ok) {
      const errData = await response.json();
      console.error("Firecrawl error:", errData);
      return new Response(JSON.stringify({ error: `Firecrawl failed: ${response.status}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const markdown = data?.data?.markdown || data?.markdown || "";

    if (!markdown) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse tweets from markdown - look for tweet-like content blocks
    const items: { title: string; link: string; description: string; pubDate: string }[] = [];
    
    // Split by common tweet separators in scraped content
    const blocks = markdown.split(/\n---\n|\n\n\n+/).filter((b: string) => b.trim().length > 30);

    for (const block of blocks) {
      if (items.length >= 10) break;
      const text = block.trim();
      
      // Only take AI-related content
      if (!isAIRelated(text)) continue;

      // Extract any URLs from the block
      const urlMatch = text.match(/https?:\/\/[^\s\)]+/);
      const link = urlMatch ? urlMatch[0] : `${profileUrl}`;

      items.push({
        title: text.slice(0, 120).replace(/\n/g, " ").trim() + (text.length > 120 ? "…" : ""),
        link,
        description: text.slice(0, 2000),
        pubDate: new Date().toISOString(),
      });
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
