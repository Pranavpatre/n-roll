const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_ids } = await req.json();
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'user_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const bearerToken = Deno.env.get('TWITTER_BEARER_TOKEN');
    if (!bearerToken) {
      return new Response(JSON.stringify({ error: 'TWITTER_BEARER_TOKEN not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolved: { id: string; username: string; name: string }[] = [];
    const failed: string[] = [];

    // Twitter allows up to 100 IDs per request
    for (let i = 0; i < user_ids.length; i += 100) {
      const batch = user_ids.slice(i, i + 100);
      const ids = batch.join(',');

      const resp = await fetch(
        `https://api.x.com/2/users?ids=${ids}&user.fields=username,name`,
        {
          headers: { Authorization: `Bearer ${bearerToken}` },
        }
      );

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`Twitter API error ${resp.status}: ${errBody}`);
        // If credits depleted, try Firecrawl fallback for this batch
        if (resp.status === 402 || resp.status === 429) {
          failed.push(...batch);
          continue;
        }
        return new Response(JSON.stringify({ error: `Twitter API error: ${resp.status} - ${errBody}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const data = await resp.json();
      if (data.data) {
        for (const user of data.data) {
          resolved.push({ id: user.id, username: user.username, name: user.name });
        }
      }

      // Rate limit: small delay between batches
      if (i + 100 < user_ids.length) {
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
