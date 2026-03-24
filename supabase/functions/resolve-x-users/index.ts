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

    const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const resolved: { id: string; username: string }[] = [];
    const failed: string[] = [];

    // Process in batches of 10 to avoid overwhelming Firecrawl
    for (let i = 0; i < user_ids.length; i += 10) {
      const batch = user_ids.slice(i, i + 10);

      const results = await Promise.allSettled(
        batch.map(async (userId: string) => {
          const url = `https://x.com/intent/user?user_id=${userId}`;
          const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              formats: ['links'],
              waitFor: 2000,
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`Firecrawl error for ${userId}: ${resp.status} ${errText}`);
            return { id: userId, username: null };
          }

          const data = await resp.json();
          // The page redirects to x.com/<username>, check metadata or sourceURL
          const sourceUrl = data?.data?.metadata?.sourceURL || data?.data?.metadata?.url || '';
          const ogUrl = data?.data?.metadata?.ogUrl || '';
          
          // Try to extract username from the resolved URL
          for (const candidate of [sourceUrl, ogUrl]) {
            const match = candidate.match(/(?:x\.com|twitter\.com)\/([A-Za-z0-9_]+)\/?$/);
            if (match && !['intent', 'i', 'home', 'search', 'explore', 'notifications'].includes(match[1].toLowerCase())) {
              return { id: userId, username: match[1] };
            }
          }

          return { id: userId, username: null };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.username) {
          resolved.push(result.value);
        } else {
          const id = result.status === 'fulfilled' ? result.value.id : batch[0];
          failed.push(id);
        }
      }

      // Log progress
      console.log(`Progress: ${Math.min(i + 10, user_ids.length)}/${user_ids.length} processed, ${resolved.length} resolved`);

      // Small delay between batches
      if (i + 10 < user_ids.length) {
        await new Promise((r) => setTimeout(r, 500));
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
