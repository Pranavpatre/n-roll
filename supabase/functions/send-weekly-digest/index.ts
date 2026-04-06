import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // This function is invoked by cron — uses service role key, not user JWT
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

    // Get top 5 digests by vote_score from the past 7 days
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: topDigests, error: digestError } = await supabase
      .from("digests")
      .select("id, title, source, url, type, vote_score, quote")
      .gte("created_at", weekAgo)
      .gt("vote_score", 0)
      .order("vote_score", { ascending: false })
      .limit(5);

    if (digestError) throw digestError;
    if (!topDigests || topDigests.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_upvoted_content" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Fetch bullet points for each digest
    const digestIds = topDigests.map((d: any) => d.id);
    const { data: points } = await supabase
      .from("digest_points")
      .select("digest_id, heading, detail, sort_order")
      .in("digest_id", digestIds)
      .order("sort_order", { ascending: true });

    const pointsByDigest = new Map<string, any[]>();
    for (const p of (points || [])) {
      const arr = pointsByDigest.get(p.digest_id) || [];
      arr.push(p);
      pointsByDigest.set(p.digest_id, arr);
    }

    // Get users who opted in to weekly digest
    const { data: prefs, error: prefsError } = await supabase
      .from("email_preferences")
      .select("user_id")
      .eq("weekly_digest", true);

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_subscribers" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user emails from auth.users
    const userIds = prefs.map((p: any) => p.user_id);
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError) throw usersError;

    const subscriberEmails = (users || [])
      .filter((u: any) => userIds.includes(u.id) && u.email)
      .map((u: any) => u.email);

    if (subscriberEmails.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_emails" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Build email HTML
    const articlesHtml = topDigests.map((d: any, i: number) => {
      const dPoints = pointsByDigest.get(d.id) || [];
      const pointsHtml = dPoints.length > 0
        ? `<ul style="margin: 10px 0 0; padding-left: 18px; color: #444; font-size: 14px; line-height: 1.6;">
            ${dPoints.map((p: any) => `<li style="margin-bottom: 6px;"><strong>${p.heading}</strong>: ${p.detail}</li>`).join("")}
           </ul>`
        : "";
      return `
      <tr>
        <td style="padding: 16px 0; border-bottom: 1px solid #e5e5e5;">
          <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
            #${i + 1} &middot; ${d.source} &middot; ${d.type}
          </div>
          <a href="${d.url}" style="color: #1a1a1a; text-decoration: none; font-size: 18px; font-weight: 600; line-height: 1.3;">
            ${d.title}
          </a>
          ${pointsHtml}
          ${d.quote ? `<div style="margin-top: 8px; padding-left: 12px; border-left: 3px solid #f59e0b; color: #666; font-style: italic; font-size: 14px;">"${d.quote}"</div>` : ""}
          <div style="margin-top: 8px;">
            <span style="background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 12px; color: #666;">
              +${d.vote_score} votes
            </span>
          </div>
        </td>
      </tr>`;
    }).join("");

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <body style="margin: 0; padding: 0; background: #fafaf8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; margin-top: 24px;">
        <tr>
          <td style="padding: 32px 24px; text-align: center; background: linear-gradient(135deg, #f59e0b, #d97706);">
            <h1 style="margin: 0; color: #1a1a1a; font-size: 28px; font-weight: 700;">AI Buzz</h1>
            <p style="margin: 8px 0 0; color: #1a1a1a; opacity: 0.7; font-size: 14px;">Your Weekly Top Stories</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px;">
            <p style="color: #666; font-size: 14px; margin: 0 0 16px;">
              Here are the most upvoted AI stories from this week:
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${articlesHtml}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px; text-align: center; border-top: 1px solid #e5e5e5;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              You're receiving this because you have weekly digests enabled on AI Buzz.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>`;

    // Send to each subscriber
    let sentCount = 0;
    for (const email of subscriberEmails) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "AI Buzz <onboarding@resend.dev>",
            to: [email],
            subject: `Your Weekly AI Buzz - Top ${topDigests.length} Stories`,
            html: emailHtml,
          }),
        });
        if (res.ok) sentCount++;
        else console.error(`Failed to send to ${email}:`, await res.text());
      } catch (e) {
        console.error(`Error sending to ${email}:`, e);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, total: subscriberEmails.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-weekly-digest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
});
