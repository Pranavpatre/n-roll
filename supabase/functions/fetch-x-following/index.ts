import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const bearerToken = Deno.env.get("TWITTER_BEARER_TOKEN");
    if (!bearerToken) {
      return new Response(JSON.stringify({ error: "Twitter Bearer Token not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "Missing username" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanUsername = username.replace(/^@/, "");
    const headers = { Authorization: `Bearer ${bearerToken}` };

    // Step 1: Get user ID from username
    console.log(`Looking up X user: @${cleanUsername}`);
    const userRes = await fetch(
      `https://api.x.com/2/users/by/username/${cleanUsername}`,
      { headers }
    );
    
    if (!userRes.ok) {
      const errText = await userRes.text();
      console.error("Twitter user lookup failed:", userRes.status, errText);
      return new Response(JSON.stringify({ error: `Twitter API error: ${userRes.status} - ${errText}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: `User @${cleanUsername} not found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found user ID: ${userId}, fetching following list...`);

    // Step 2: Fetch following list with pagination
    const allFollowing: { username: string; name: string }[] = [];
    let paginationToken: string | undefined;

    do {
      const url = new URL(`https://api.x.com/2/users/${userId}/following`);
      url.searchParams.set("max_results", "1000");
      if (paginationToken) url.searchParams.set("pagination_token", paginationToken);

      const followRes = await fetch(url.toString(), { headers });
      
      if (!followRes.ok) {
        const errText = await followRes.text();
        console.error("Twitter following fetch failed:", followRes.status, errText);
        break;
      }

      const followData = await followRes.json();
      const users = followData.data || [];
      
      for (const u of users) {
        allFollowing.push({ username: u.username, name: u.name });
      }

      paginationToken = followData.meta?.next_token;
      console.log(`Fetched ${users.length} follows (total: ${allFollowing.length}), next_token: ${paginationToken || "none"}`);
    } while (paginationToken);

    console.log(`Total following: ${allFollowing.length}`);

    // Step 3: Get existing feeds to skip duplicates
    const { data: existingFeeds } = await supabase
      .from("feeds")
      .select("url")
      .eq("user_id", user.id);

    const existingUrls = new Set((existingFeeds || []).map((f: any) => f.url));

    // Step 4: Bulk insert new feeds
    const newFeeds = allFollowing
      .filter((f) => !existingUrls.has(`x:@${f.username}`))
      .map((f) => ({
        name: `@${f.username}`,
        url: `x:@${f.username}`,
        type: "news",
        user_id: user.id,
      }));

    let imported = 0;
    if (newFeeds.length > 0) {
      // Insert in batches of 50
      for (let i = 0; i < newFeeds.length; i += 50) {
        const batch = newFeeds.slice(i, i + 50);
        const { error: insertError } = await supabase.from("feeds").insert(batch);
        if (insertError) {
          console.error("Insert error:", insertError);
        } else {
          imported += batch.length;
        }
      }
    }

    const skipped = allFollowing.length - newFeeds.length;

    return new Response(JSON.stringify({
      total: allFollowing.length,
      imported,
      skipped,
      following: allFollowing.map((f) => `@${f.username}`),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fetch-x-following error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
