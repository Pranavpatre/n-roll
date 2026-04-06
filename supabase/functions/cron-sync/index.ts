import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const CRON_SECRET = Deno.env.get("CRON_SECRET")!;
  const EDGE_BASE = `${SUPABASE_URL}/functions/v1`;

  const adminSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Get all distinct users who have active feeds
  const { data: feedRows, error: feedsError } = await adminSupabase
    .from("feeds")
    .select("user_id")
    .eq("active", true);

  if (feedsError) {
    console.error("Failed to fetch feeds:", feedsError);
    return new Response(JSON.stringify({ error: feedsError.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userIds = [...new Set((feedRows || []).map((r: any) => r.user_id))];
  console.log(`Cron sync starting for ${userIds.length} users`);

  const cronHeaders = {
    "Content-Type": "application/json",
    "X-Cron-Secret": CRON_SECRET,
  };

  const results: { userId: string; fetched: number; summarized: number; error?: string }[] = [];

  for (const userId of userIds) {
    try {
      // 1. Fetch new RSS items for this user
      const rssRes = await fetch(`${EDGE_BASE}/fetch-rss`, {
        method: "POST",
        headers: cronHeaders,
        body: JSON.stringify({ userId }),
      });

      if (!rssRes.ok) {
        const msg = await rssRes.text();
        console.error(`fetch-rss failed for ${userId}: ${msg}`);
        results.push({ userId, fetched: 0, summarized: 0, error: msg });
        continue;
      }

      const rssData = await rssRes.json();
      const items: any[] = rssData?.items || [];
      console.log(`User ${userId}: ${items.length} new items`);

      if (items.length === 0) {
        results.push({ userId, fetched: 0, summarized: 0 });
        continue;
      }

      // 2. Summarize in batches of 5
      let summarized = 0;
      const BATCH_SIZE = 5;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(
          batch.map((item: any) =>
            fetch(`${EDGE_BASE}/summarize`, {
              method: "POST",
              headers: cronHeaders,
              body: JSON.stringify({ item, userId }),
            }).then((r) => r.json())
          )
        );
        summarized += batchResults.filter(
          (r) => r.status === "fulfilled" && !(r as PromiseFulfilledResult<any>).value?.error
        ).length;
      }

      results.push({ userId, fetched: items.length, summarized });
    } catch (e: any) {
      console.error(`Cron sync error for ${userId}:`, e);
      results.push({ userId, fetched: 0, summarized: 0, error: e.message });
    }
  }

  console.log("Cron sync complete:", JSON.stringify(results));

  return new Response(JSON.stringify({ ok: true, users: userIds.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
