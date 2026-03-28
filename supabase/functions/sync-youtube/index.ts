import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { providerToken } = await req.json();
    if (!providerToken) {
      return new Response(JSON.stringify({ error: "Google provider token required. Sign in with Google first." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch YouTube subscriptions
    const subs: any[] = [];
    let pageToken = "";
    for (let i = 0; i < 5; i++) { // max 5 pages = 250 subs
      const url = `https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ""}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${providerToken}` } });
      if (!res.ok) {
        const t = await res.text();
        console.error("YouTube API error:", res.status, t);
        return new Response(JSON.stringify({ error: "YouTube API error", details: t }), {
          status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = await res.json();
      subs.push(...(data.items || []));
      if (!data.nextPageToken) break;
      pageToken = data.nextPageToken;
    }

    // Get existing feeds for user
    const { data: existingFeeds } = await supabase
      .from("feeds")
      .select("url")
      .eq("user_id", userId);
    const existingUrls = new Set((existingFeeds || []).map((f: any) => f.url));

    // Insert new feeds
    const newFeeds = subs
      .map((s: any) => {
        const channelId = s.snippet?.resourceId?.channelId;
        if (!channelId) return null;
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        if (existingUrls.has(feedUrl)) return null;
        return {
          user_id: userId,
          name: s.snippet?.title || "Unknown Channel",
          type: "podcast" as const,
          url: feedUrl,
          active: true,
        };
      })
      .filter(Boolean);

    if (newFeeds.length > 0) {
      const { error: insertError } = await supabase.from("feeds").insert(newFeeds);
      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(JSON.stringify({ error: "Failed to save feeds" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ synced: newFeeds.length, total: subs.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-youtube error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
