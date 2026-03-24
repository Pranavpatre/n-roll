const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_ids } = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'user_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolved: { id: string; username: string }[] = [];
    const failed: string[] = [];

    // Process in batches of 5 with delays to avoid rate limiting
    for (let i = 0; i < user_ids.length; i += 5) {
      const batch = user_ids.slice(i, i + 5);

      const results = await Promise.allSettled(
        batch.map(async (userId: string) => {
          try {
            // Follow the redirect from x.com/intent/user?user_id=X
            // Using redirect: 'manual' to capture the Location header
            const resp = await fetch(`https://x.com/intent/user?user_id=${userId}`, {
              redirect: 'manual',
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; bot)',
              },
            });

            // Check for redirect (301/302/303/307/308)
            const location = resp.headers.get('location') || '';
            const match = location.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/?$/);
            if (match && !['intent', 'i', 'home', 'search', 'explore', 'notifications', 'login'].includes(match[1].toLowerCase())) {
              return { id: userId, username: match[1] };
            }

            // If no redirect, try reading the response body for meta refresh or og:url
            if (resp.status === 200) {
              const html = await resp.text();
              // Look for screen_name or username in the HTML
              const ogMatch = html.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]{1,15})(?:["'\s?/])/);
              if (ogMatch && !['intent', 'i', 'home', 'search', 'explore', 'notifications', 'login', 'account'].includes(ogMatch[1].toLowerCase())) {
                return { id: userId, username: ogMatch[1] };
              }
            }

            return { id: userId, username: null };
          } catch (e) {
            console.error(`Error resolving ${userId}:`, e.message);
            return { id: userId, username: null };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.username) {
          resolved.push(result.value as { id: string; username: string });
        } else {
          const id = result.status === 'fulfilled' ? result.value.id : batch[0];
          failed.push(id);
        }
      }

      console.log(`Progress: ${Math.min(i + 5, user_ids.length)}/${user_ids.length} processed, ${resolved.length} resolved`);

      // Delay between batches to be polite
      if (i + 5 < user_ids.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    return new Response(JSON.stringify({ resolved, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error resolving users:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
