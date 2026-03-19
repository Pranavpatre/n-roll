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

    const { item } = await req.json();
    if (!item?.title) {
      return new Response(JSON.stringify({ error: "Item with title required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are a digest summarizer. Given an article or podcast episode title and description, produce a structured summary. Return valid JSON with this schema:
{
  "points": [{"heading": "short label", "detail": "1-2 sentence explanation"}],
  "quote": "optional memorable quote from the content",
  "guest": "guest name if applicable",
  "guestBio": "one-line guest bio if applicable",
  "author": "author name if applicable"
}
Return 3-6 key points. Be concise, insightful, and specific. If there's no guest/author info, omit those fields. Always return valid JSON only, no markdown.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Title: ${item.title}\nSource: ${item.feedName}\nType: ${item.feedType}\nDescription: ${item.description || "No description available."}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResponse.text();
      console.error("AI error:", status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "{}";

    let summary;
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      summary = JSON.parse(cleaned);
    } catch {
      summary = { points: [{ heading: "Summary", detail: content.slice(0, 500) }] };
    }

    // Save digest to DB
    const now = new Date();
    const dateStr = `Today, ${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;

    const { data: digest, error: digestError } = await supabase
      .from("digests")
      .insert({
        user_id: userId,
        feed_id: item.feedId,
        title: item.title,
        source: item.feedName,
        guest: summary.guest || null,
        guest_bio: summary.guestBio || null,
        author: summary.author || null,
        url: item.link,
        date: dateStr,
        quote: summary.quote || null,
        type: item.feedType,
      })
      .select()
      .single();

    if (digestError) throw digestError;

    // Save digest points
    if (summary.points?.length > 0) {
      const points = summary.points.map((p: any, i: number) => ({
        digest_id: digest.id,
        heading: p.heading || "Point",
        detail: p.detail || "",
        sort_order: i,
      }));
      await supabase.from("digest_points").insert(points);
    }

    return new Response(JSON.stringify({ digest, points: summary.points }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
