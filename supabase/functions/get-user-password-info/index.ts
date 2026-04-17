import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error('Not authenticated');

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['super_admin', 'editor', 'viewer'])
      .maybeSingle();

    if (!roleData) throw new Error('Not authorized');

    const { userId } = await req.json();
    if (!userId) throw new Error('userId is required');

    // Use admin client with auth schema query via REST is restricted;
    // use the admin getUserById and infer from identities + check via a direct SQL through pg.
    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (uErr || !u?.user) throw new Error(uErr?.message || 'User not found');

    // An "email" identity exists iff the user signed up with email/password (or had one set).
    // OAuth-only users (Google/Apple) have no 'email' identity entry => no password.
    const emailIdentity = u.user.identities?.find((i: any) => i.provider === 'email');
    const hasPassword = !!emailIdentity;

    // For password set date, use the email identity's updated_at when available;
    // otherwise fall back to the user's created_at.
    const passwordSetAt = hasPassword
      ? ((emailIdentity as any).updated_at || (emailIdentity as any).created_at || u.user.created_at)
      : null;

    return new Response(JSON.stringify({
      success: true,
      hasPassword,
      passwordSetAt,
      createdAt: u.user.created_at,
      providers: (u.user.identities || []).map((i: any) => i.provider),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
