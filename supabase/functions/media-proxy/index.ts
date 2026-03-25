const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mediaUrl = url.searchParams.get('url');

    if (!mediaUrl) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL is from known media providers
    const allowedHosts = ['waba-v1.era.com.br', 'lookaside.fbcdn.net', 'scontent.whatsapp.net', 'mmg.whatsapp.net'];
    const parsed = new URL(mediaUrl);
    if (!allowedHosts.some(h => parsed.hostname.endsWith(h))) {
      return new Response(JSON.stringify({ error: 'URL not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the media
    const mediaResponse = await fetch(mediaUrl);

    if (!mediaResponse.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch media: ${mediaResponse.status}` }), {
        status: mediaResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const contentType = mediaResponse.headers.get('content-type') || 'application/octet-stream';
    const body = await mediaResponse.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
