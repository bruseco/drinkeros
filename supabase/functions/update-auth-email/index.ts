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

    // Verify caller is super_admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Not authenticated');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token);
    if (!caller) throw new Error('Not authenticated');

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (!roleData) throw new Error('Not authorized - super_admin only');

    const { userId, newEmail } = await req.json();
    if (!userId || !newEmail) throw new Error('userId and newEmail are required');

    console.log(`Updating email for user ${userId} to ${newEmail}`);

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      email: newEmail,
      email_confirm: true,
    });

    if (error) {
      console.error('updateUserById error:', JSON.stringify(error));
      throw error;
    }

    console.log('updateUserById result:', JSON.stringify({ email: data.user.email, id: data.user.id }));

    // Verify the email was actually changed
    if (data.user.email !== newEmail) {
      console.error(`Email mismatch: expected ${newEmail}, got ${data.user.email}`);
      throw new Error(`Email não foi alterado. O Auth retornou: ${data.user.email}`);
    }

    // Also update profiles table (uses service_role, bypasses RLS)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ email: newEmail })
      .eq('user_id', userId);

    if (profileError) {
      console.error('profiles update error:', JSON.stringify(profileError));
      throw new Error(`Auth atualizado mas profiles falhou: ${profileError.message}`);
    }

    console.log('profiles.email updated successfully for user', userId);

    return new Response(JSON.stringify({ success: true, email: data.user.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('update-auth-email error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Return 200 so client can read the body
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
