import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CreateUserRequest {
  email: string;
  fullName?: string;
  packageIds?: string[];
  comboIds?: string[];
  courseIds?: string[];
  ebookIds?: string[];
  phone?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the requester is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requester }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !requester) {
      throw new Error("Invalid token");
    }

    // Check if requester can edit (is admin)
    const { data: canEdit } = await supabase.rpc("can_edit", { _user_id: requester.id });
    if (!canEdit) {
      throw new Error("Permission denied");
    }

    const { email, fullName, packageIds, phone }: CreateUserRequest = await req.json();

    if (!email) {
      throw new Error("Email is required");
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists in profiles
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ success: false, error: "Usuário já existe com este e-mail" }),
        { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate temporary password
    const tempPassword = crypto.randomUUID().slice(0, 12);

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (createError) {
      // Handle duplicate in auth.users (profile check may miss orphaned auth entries)
      if (createError.message?.includes("already been registered")) {
        return new Response(
          JSON.stringify({ success: false, error: "Usuário já existe com este e-mail" }),
          { status: 409, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      throw new Error(`Failed to create user: ${createError.message}`);
    }

    const userId = newUser.user.id;

    // Assign packages if provided
    if (packageIds && packageIds.length > 0) {
      const { error: packagesError } = await supabase.from("user_packages").insert(
        packageIds.map((packageId) => ({
          user_id: userId,
          package_id: packageId,
        }))
      );

      if (packagesError) {
        console.warn("Failed to assign packages:", packagesError);
      }
    }

    // Send welcome email
    const loginUrl = "https://alunos.criminallab.com.br";
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
          loginUrl: `${loginUrl}/login`,
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

    // Check if WhatsApp welcome is enabled
    const { data: agentSettings } = await supabase
      .from("whatsapp_agent_settings")
      .select("whatsapp_welcome_enabled")
      .limit(1)
      .single();

    const whatsappWelcomeEnabled = agentSettings?.whatsapp_welcome_enabled !== false;

    // Send WhatsApp welcome if phone is available and feature is enabled
    const welcomePhone = phone || null;
    // If no phone provided, try to get from profile
    let resolvedPhone = welcomePhone;
    if (!resolvedPhone) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("phone")
        .eq("user_id", userId)
        .maybeSingle();
      resolvedPhone = profileData?.phone || null;
    }

    if (resolvedPhone && whatsappWelcomeEnabled) {
      try {
        // Get product names from assigned packages
        let productNames: string[] = [];
        if (packageIds && packageIds.length > 0) {
          const { data: pkgs } = await supabase
            .from("packages")
            .select("name")
            .in("id", packageIds);
          productNames = (pkgs || []).map((p: any) => p.name);
        }

        // Insert into queue
        for (const pName of productNames.length > 0 ? productNames : [null]) {
          await supabase.from("whatsapp_welcome_queue").insert({
            phone: resolvedPhone,
            email,
            full_name: fullName || email.split("@")[0],
            product_name: pName,
            temporary_password: tempPassword,
            is_new_user: true,
          });
        }

        console.log(`WhatsApp welcome queued for ${resolvedPhone} (${productNames.length} products). Cron will process.`);
      } catch (whatsappError) {
        console.warn("Error queuing WhatsApp welcome:", whatsappError);
      }
    }

    // Log to webhook_logs
    const processingTime = Date.now() - startTime;
    try {
      await supabase.from("webhook_logs").insert({
        source: "admin_manual",
        email,
        user_name: fullName || null,
        phone: phone || null,
        user_id: userId,
        is_new_user: true,
        status: "success",
        status_detail: `Usuário criado manualmente pelo admin ${requester.email}`,
        raw_payload: { email, fullName, packageIds } as any,
        processing_time_ms: processingTime,
      });
    } catch (logError) {
      console.warn("Failed to insert webhook log:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: userId, email },
        message: "User created successfully. Welcome email sent.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: error.message === "Permission denied" ? 403 : 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
