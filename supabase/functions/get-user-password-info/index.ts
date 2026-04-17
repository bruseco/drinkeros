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

    // Verify caller is admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .in('role', ['super_admin', 'editor', 'viewer'])
      .maybeSingle();

    if (!roleData) throw new Error('Not authorized');

    const { userId } = await req.json();
    if (!userId) throw new Error('userId is required');

    // Query auth.users directly via service role
    const { data, error } = await supabaseAdmin
      .from('users' as any)
      .select('encrypted_password, created_at, updated_at, last_sign_in_at')
      .eq('id', userId)
      .schema('auth' as any)
      .maybeSingle();

    let hasPassword = false;
    let passwordSetAt: string | null = null;
    let createdAt: string | null = null;

    if (!error && data) {
      hasPassword = !!(data as any).encrypted_password;
      createdAt = (data as any).created_at;
      // Best approximation: updated_at reflects last password/profile change
      passwordSetAt = hasPassword ? ((data as any).updated_at || (data as any).created_at) : null;
    } else {
      // Fallback via admin API
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (u?.user) {
        // Heuristic: if user has email identity, they likely have a password
        const emailIdentity = u.user.identities?.find((i: any) => i.provider === 'email');
        hasPassword = !!emailIdentity;
        createdAt = u.user.created_at;
        passwordSetAt = hasPassword ? (u.user.updated_at || u.user.created_at) : null;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      hasPassword,
      passwordSetAt,
      createdAt,
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
