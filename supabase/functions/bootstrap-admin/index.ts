import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface BootstrapAdminRequest {
  email: string;
  fullName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Security check: Verify no super_admin exists yet
    const { data: existingAdmins, error: checkError } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "super_admin")
      .limit(1);

    if (checkError) {
      throw new Error(`Failed to check existing admins: ${checkError.message}`);
    }

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Bootstrap denied: A super_admin already exists. This function can only be used once.",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { email, fullName }: BootstrapAdminRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === email);

    if (existingUser) {
      throw new Error("User already exists with this email");
    }

    // Generate temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create user with admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    const userId = newUser.user.id;

    // Assign super_admin role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "super_admin",
    });

    if (roleError) {
      // Rollback: delete user if role assignment fails
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Failed to assign super_admin role: ${roleError.message}`);
    }

    // Send welcome email
    const loginUrl = Deno.env.get("SITE_URL") || "https://criminallab.lovable.app";
    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          email,
          fullName,
          temporaryPassword: tempPassword,
          loginUrl: `${loginUrl}/admin/login`,
        }),
      });

      if (!emailResponse.ok) {
        console.warn("Failed to send welcome email:", await emailResponse.text());
      } else {
        console.log("Welcome email sent successfully");
      }
    } catch (emailError) {
      console.warn("Error sending welcome email:", emailError);
    }

    console.log(`Bootstrap admin created successfully: ${email} (${userId})`);

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email },
        message: "Super admin created successfully. Welcome email sent with temporary password.",
        temporaryPassword: tempPassword, // Include in response as backup
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in bootstrap-admin:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
