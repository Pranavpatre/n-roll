import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEARCH_QUERIES = [
  "AI news artificial intelligence",
  "machine learning tutorial",
  "LLM large language model",
  "AI tools productivity",
];

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) {
      return new Response(JSON.stringify({ error: "YOUTUBE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's existing feed URLs to filter out already-added channels
    const { data: existingFeeds } = await supabase
      .from("feeds")
      .select("url")
      .eq("user_id", userId);
    const existingUrls = new Set((existingFeeds || []).map((f: any) => f.url));

    const seenChannelIds = new Set<string>();
    const channels: { name: string; channelId: string; description: string; subscriberCount: string; thumbnail: string }[] = [];

    // Search for AI channels across multiple queries
    for (const query of SEARCH_QUERIES) {
      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=10&key=${YOUTUBE_API_KEY}`;
        const res = await fetch(searchUrl);
        if (!res.ok) {
          console.error(`YouTube search failed for "${query}": ${res.status}`);
          continue;
        }
        const data = await res.json();
        const items = data.items || [];

        // Collect channel IDs for statistics lookup
        const channelIds = items
          .map((item: any) => item.snippet?.channelId || item.id?.channelId)
          .filter((id: string) => id && !seenChannelIds.has(id));

        if (channelIds.length === 0) continue;

        // Get channel statistics (subscriber count)
        const statsUrl = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelIds.join(",")}&key=${YOUTUBE_API_KEY}`;
        const statsRes = await fetch(statsUrl);
        if (!statsRes.ok) continue;
        const statsData = await statsRes.json();

        for (const ch of statsData.items || []) {
          const channelId = ch.id;
          if (seenChannelIds.has(channelId)) continue;
          seenChannelIds.add(channelId);

          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          if (existingUrls.has(rssUrl)) continue;

          const subCount = parseInt(ch.statistics?.subscriberCount || "0", 10);
          let subscriberCount: string;
          if (subCount >= 1_000_000) subscriberCount = `${(subCount / 1_000_000).toFixed(1)}M`;
          else if (subCount >= 1_000) subscriberCount = `${(subCount / 1_000).toFixed(0)}K`;
          else subscriberCount = String(subCount);

          channels.push({
            name: ch.snippet?.title || "Unknown",
            channelId,
            description: (ch.snippet?.description || "").slice(0, 150),
            subscriberCount,
            thumbnail: ch.snippet?.thumbnails?.default?.url || "",
          });
        }
      } catch (e) {
        console.error(`Error searching YouTube for "${query}":`, e);
      }
    }

    // Sort by subscriber count descending
    channels.sort((a, b) => {
      const parseCount = (s: string) => {
        if (s.endsWith("M")) return parseFloat(s) * 1_000_000;
        if (s.endsWith("K")) return parseFloat(s) * 1_000;
        return parseInt(s, 10);
      };
      return parseCount(b.subscriberCount) - parseCount(a.subscriberCount);
    });

    return new Response(JSON.stringify({ channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("discover-youtube error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
