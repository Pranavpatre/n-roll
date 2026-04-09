import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Missing unsubscribe token.", { status: 400, headers: { "Content-Type": "text/plain" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("email_preferences")
    .update({ weekly_digest: false })
    .eq("unsubscribe_token", token);

  if (error) {
    console.error("Unsubscribe error:", error);
    return new Response("Something went wrong. Please try again.", {
      status: 500, headers: { "Content-Type": "text/plain" },
    });
  }

  return new Response(
    `<!DOCTYPE html>
<html>
<body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fafaf8;text-align:center;">
  <div style="max-width:480px;margin:0 auto;background:white;padding:40px;border-radius:12px;">
    <h2 style="margin:0 0 12px;color:#1a1a1a;">Unsubscribed</h2>
    <p style="color:#666;margin:0;">You've been removed from the AI Buzz weekly digest. You can re-enable it anytime from your account settings.</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
});
