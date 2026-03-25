import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SESClient, SendEmailCommand } from "npm:@aws-sdk/client-ses@3.485.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sesClient = new SESClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get("AWS_ACCESS_KEY_ID")!,
    secretAccessKey: Deno.env.get("AWS_SECRET_ACCESS_KEY")!,
  },
});

async function sendEmailViaSES(params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const command = new SendEmailCommand({
    Source: params.from,
    Destination: { ToAddresses: params.to },
    Message: {
      Subject: { Data: params.subject, Charset: "UTF-8" },
      Body: { Html: { Data: params.html, Charset: "UTF-8" } },
    },
    ReplyToAddresses: params.replyTo ? [params.replyTo] : undefined,
    Tags: [
      { Name: "email_type", Value: "transactional" },
    ],
  });
  return sesClient.send(command);
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional webhook secret validation
    const webhookSecret = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET");
    if (webhookSecret) {
      const receivedSecret =
        req.headers.get("x-webhook-secret") ||
        new URL(req.url).searchParams.get("secret");
      if (receivedSecret !== webhookSecret) {
        console.error("Invalid webhook secret");
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Parse payload - support both JSON and form-urlencoded
    const contentType = req.headers.get("content-type") || "";
    let body: Record<string, string>;

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      // Handle form-urlencoded (default WooCommerce format)
      const text = await req.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    }

    const { nome, email, telefone, id, cpf: rawCpf } = body;

    if (!email || !id) {
      // Log missing fields
      await supabase.from("webhook_logs").insert({
        source: "woocommerce",
        status: "error",
        status_detail: "Campos obrigatórios ausentes: email e id",
        error_message: "Missing required fields: email and id",
        raw_payload: body as any,
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ error: "Missing required fields: email and id" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedId = String(id).trim();

    // 1. Find the package or course by woocommerce_product_id
    const { data: pkg, error: pkgError } = await supabase
      .from("packages")
      .select("id, name")
      .eq("woocommerce_product_id", trimmedId)
      .single();

    // If not found in packages, try courses
    let courseData: { id: string; name: string } | null = null;
    let courseModuleIds: string[] = [];
    let comboData: { id: string; name: string } | null = null;
    let comboCourseIds: string[] = [];

    if (pkgError || !pkg) {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, name")
        .eq("woocommerce_product_id", trimmedId)
        .single();

      if (courseError || !course) {
        // Try combos
        const { data: combo, error: comboError } = await supabase
          .from("combos")
          .select("id, name")
          .eq("woocommerce_product_id", trimmedId)
          .single();

        if (comboError || !combo) {
          console.error("Package/Course/Combo not found for woocommerce_product_id:", trimmedId);

          await supabase.from("webhook_logs").insert({
            source: "woocommerce",
            product_id: trimmedId,
            email: trimmedEmail,
            phone: telefone?.trim() || null,
            user_name: nome?.trim() || null,
            status: "error",
            status_detail: `Produto WooCommerce ID ${trimmedId} não encontrado nos módulos, cursos ou combos`,
            error_message: `No package, course or combo found for product id: ${trimmedId}`,
            raw_payload: body as any,
            processing_time_ms: Date.now() - startTime,
          });

          return new Response(
            JSON.stringify({ error: `No package, course or combo found for product id: ${trimmedId}` }),
            { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }

        comboData = combo;

        // Get all courses in this combo
        const { data: comboCourses } = await supabase
          .from("combo_courses")
          .select("course_id")
          .eq("combo_id", combo.id)
          .order("display_order", { ascending: true });

        comboCourseIds = (comboCourses || []).map((cc: any) => cc.course_id);
        console.log(`Combo found: ${combo.name} (${combo.id}) with ${comboCourseIds.length} courses`);
      } else {
        courseData = course;

        // Get all modules in this course
        const { data: coursePackages } = await supabase
          .from("course_packages")
          .select("package_id")
          .eq("course_id", course.id)
          .order("display_order", { ascending: true });

        courseModuleIds = (coursePackages || []).map((cp: any) => cp.package_id);
        console.log(`Course found: ${course.name} (${course.id}) with ${courseModuleIds.length} modules`);
      }
    } else {
      console.log(`Package found: ${pkg.name} (${pkg.id})`);
    }

    // 2. Check if user already exists (via profiles table - no row limit)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", trimmedEmail)
      .maybeSingle();
    
    const existingUser = existingProfile ? { id: existingProfile.user_id } : null;

    const loginUrl = "https://alunos.criminallab.com.br";
    let userId: string;
    let isNewUser = false;
    let tempPassword = "";
    let alreadyHasAccess = false;

    if (!existingUser) {
      // 3a. Create new user
      isNewUser = true;
      tempPassword = crypto.randomUUID().slice(0, 12);
      const userName = nome?.trim() || trimmedEmail.split("@")[0];

      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: trimmedEmail,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: userName },
        });

      if (createError || !newUser.user) {
        console.error("Failed to create user:", createError);

        // Log user creation failure
        await supabase.from("webhook_logs").insert({
          source: "woocommerce",
          product_id: trimmedId,
          product_name: courseData ? courseData.name : pkg!.name,
          email: trimmedEmail,
          phone: telefone?.trim() || null,
          user_name: nome?.trim() || null,
          status: "error",
          status_detail: `Falha ao criar usuário: ${createError?.message}`,
          error_message: createError?.message,
          is_new_user: true,
          raw_payload: body as any,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: `Failed to create user: ${createError?.message}` }),
          {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
      }

      userId = newUser.user.id;
      console.log(`New user created: ${trimmedEmail} (${userId})`);

      // Update profile with phone and CPF
      const newUserUpdate: Record<string, string> = {};
      if (telefone) newUserUpdate.phone = telefone.trim();
      if (rawCpf) newUserUpdate.cpf = String(rawCpf).replace(/\D/g, '');
      if (Object.keys(newUserUpdate).length > 0) {
        await supabase
          .from("profiles")
          .update(newUserUpdate)
          .eq("user_id", userId);
      }
    } else {
      // 3b. Existing user
      userId = existingUser.id;
      console.log(`Existing user found: ${trimmedEmail} (${userId})`);

      // Update phone and CPF if provided (CPF only if not already set)
      if (telefone) {
        await supabase
          .from("profiles")
          .update({ phone: telefone.trim() })
          .eq("user_id", userId);
      }
      if (rawCpf) {
        // Only set CPF if not already saved (immutable)
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("cpf")
          .eq("user_id", userId)
          .single();
        if (!existingProfile?.cpf) {
          await supabase
            .from("profiles")
            .update({ cpf: String(rawCpf).replace(/\D/g, '') })
            .eq("user_id", userId);
        }
      }

      // Check if already has access (for module, course or combo)
      if (comboData) {
        const { data: existingComboAccess } = await supabase
          .from("user_combos")
          .select("id")
          .eq("user_id", userId)
          .eq("combo_id", comboData.id)
          .maybeSingle();

        if (existingComboAccess) {
          console.log(`User already has access to combo: ${comboData.name} (skipping grant, will still notify)`);
          alreadyHasAccess = true;
        }
      } else if (courseData) {
        const { data: existingCourseAccess } = await supabase
          .from("user_courses")
          .select("id")
          .eq("user_id", userId)
          .eq("course_id", courseData.id)
          .maybeSingle();

        if (existingCourseAccess) {
          console.log(`User already has access to course: ${courseData.name} (skipping grant, will still notify)`);
          alreadyHasAccess = true;
        }
      } else {
        const { data: existingAccess } = await supabase
          .from("user_packages")
          .select("id")
          .eq("user_id", userId)
          .eq("package_id", pkg!.id)
          .maybeSingle();

        if (existingAccess) {
          console.log(`User already has access to package: ${pkg!.name} (skipping grant, will still notify)`);
          alreadyHasAccess = true;
        }
      }
    }

    // Determine the product name for email
    const productName = comboData ? comboData.name : courseData ? courseData.name : pkg!.name;

    // 4. Grant access (skip if already has it)
    if (!alreadyHasAccess && comboData) {
      // Grant combo access
      const { error: comboAccessError } = await supabase.from("user_combos").insert({
        user_id: userId,
        combo_id: comboData.id,
      });
      if (comboAccessError) {
        console.error("Failed to grant combo access:", comboAccessError);
      }

      // Get courses for this combo and grant access
      for (const comboCourseId of comboCourseIds) {
        // Grant course access
        await supabase.from("user_courses").upsert(
          { user_id: userId, course_id: comboCourseId },
          { onConflict: 'user_id,course_id', ignoreDuplicates: true }
        );

        // Get modules for this course and grant access
        const { data: courseModules } = await supabase
          .from("course_packages")
          .select("package_id")
          .eq("course_id", comboCourseId);

        for (const cm of (courseModules || [])) {
          await supabase.from("user_packages").upsert(
            { user_id: userId, package_id: cm.package_id },
            { onConflict: 'user_id,package_id', ignoreDuplicates: true }
          );
        }
      }

      console.log(`Combo access granted to ${comboData.name} (${comboCourseIds.length} courses) for user ${userId}`);
    } else if (!alreadyHasAccess && courseData) {
      // Grant course access
      const { error: courseAccessError } = await supabase.from("user_courses").insert({
        user_id: userId,
        course_id: courseData.id,
      });

      if (courseAccessError) {
        console.error("Failed to grant course access:", courseAccessError);
      }

      // Grant access to all modules in the course
      for (const moduleId of courseModuleIds) {
        const { error: moduleAccessError } = await supabase.from("user_packages").upsert(
          { user_id: userId, package_id: moduleId },
          { onConflict: 'user_id,package_id', ignoreDuplicates: true }
        );
        if (moduleAccessError) {
          console.error(`Failed to grant module access for ${moduleId}:`, moduleAccessError);
        }
      }

      console.log(`Course access granted to ${courseData.name} (${courseModuleIds.length} modules) for user ${userId}`);
    } else if (!alreadyHasAccess) {
      // Grant single module access
      const { error: accessError } = await supabase.from("user_packages").insert({
        user_id: userId,
        package_id: pkg!.id,
      });

      if (accessError) {
        console.error("Failed to grant access:", accessError);

        await supabase.from("webhook_logs").insert({
          source: "woocommerce",
          product_id: trimmedId,
          product_name: productName,
          email: trimmedEmail,
          phone: telefone?.trim() || null,
          user_name: nome?.trim() || null,
          status: "error",
          status_detail: `Falha ao liberar acesso: ${accessError.message}`,
          error_message: accessError.message,
          user_id: userId,
          is_new_user: isNewUser,
          raw_payload: body as any,
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ error: `Failed to grant access: ${accessError.message}` }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Access granted to ${pkg!.name} for user ${userId}`);
    }

    // 5. Send module access email
    try {
      const userName = nome?.trim() || trimmedEmail.split("@")[0];

      // Fetch email settings and template
      const [settingsResult, templateResult] = await Promise.all([
        supabase.from("email_settings").select("*").limit(1).single(),
        supabase.from("email_templates").select("*").eq("slug", "module-access").single(),
      ]);

      const senderName = settingsResult.data?.sender_name || "Criminal Lab";
      const senderEmail = settingsResult.data?.sender_email || "noreply@criminallab.com.br";
      const replyTo = settingsResult.data?.reply_to_email || undefined;

      let subject = templateResult.data?.subject || `Seu acesso ao ${comboData ? 'combo' : courseData ? 'curso' : 'módulo'} ${productName} está liberado!`;
      let htmlBody = templateResult.data?.html_body || getDefaultTemplate();

      // Build password section
      const passwordSection = isNewUser
        ? `<p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">
            Criamos uma conta para você. Aqui estão seus dados de acesso:<br/>
            <strong>Email:</strong> ${trimmedEmail}<br/>
            <strong>Senha temporária:</strong> <code style="background:#2a2a2a;padding:4px 8px;border-radius:4px;color:#dc2626;">${tempPassword}</code>
          </p>
          <p style="font-size: 14px; color: #a3a3a3;">Recomendamos que você altere sua senha após o primeiro acesso.</p>`
        : `<p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">
            Use seu email <strong>${trimmedEmail}</strong> e sua senha atual para acessar.
          </p>`;

      // Replace variables in subject and body
      subject = subject
        .replaceAll("{{user_name}}", userName)
        .replaceAll("{{module_name}}", productName);

      htmlBody = htmlBody
        .replaceAll("{{user_name}}", userName)
        .replaceAll("{{email}}", trimmedEmail)
        .replaceAll("{{module_name}}", productName)
        .replaceAll("{{login_url}}", `${loginUrl}/login`)
        .replaceAll("{{password_section}}", passwordSection);

      // Deduplication: check if we already sent an email to this user in the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: recentEmail } = await supabase
        .from("webhook_logs")
        .select("id")
        .eq("email", trimmedEmail)
        .eq("source", "woocommerce")
        .eq("status", "success")
        .gte("created_at", thirtyMinutesAgo)
        .limit(1)
        .maybeSingle();

      if (recentEmail) {
        console.log(`Email já enviado para ${trimmedEmail} nos últimos 30 min. Pulando envio duplicado.`);
      } else {
        await sendEmailViaSES({
          from: `${senderName} <${senderEmail}>`,
          to: [trimmedEmail],
          subject,
          html: htmlBody,
          replyTo,
        });

        console.log(`Access email sent to ${trimmedEmail} for ${productName}`);
      }
    } catch (emailError) {
      console.error("Failed to send module access email:", emailError);
    }

    // 6. Queue WhatsApp welcome (3-min delay for consolidation)
    const { data: agentSettings } = await supabase
      .from("whatsapp_agent_settings")
      .select("whatsapp_welcome_enabled")
      .limit(1)
      .single();
    const whatsappWelcomeEnabled = agentSettings?.whatsapp_welcome_enabled !== false;
    const welcomePhone = telefone?.trim() || null;
    if (welcomePhone && whatsappWelcomeEnabled) {
      try {
        // Insert into queue
        const { error: queueError } = await supabase.from("whatsapp_welcome_queue").insert({
          phone: welcomePhone,
          email: trimmedEmail,
          full_name: nome?.trim() || trimmedEmail.split("@")[0],
          product_name: productName,
          temporary_password: isNewUser ? tempPassword : null,
          is_new_user: isNewUser,
        });

        if (queueError) {
          console.error("Failed to queue WhatsApp welcome:", queueError);
        } else {
          console.log(`WhatsApp welcome queued for ${welcomePhone} (product: ${productName}). Cron will process.`);
        }
      } catch (whatsappError) {
        console.warn("Error queuing WhatsApp welcome:", whatsappError);
      }
    }

    // 7. AUTO-CONVERT CRM LEADS: mark active leads with same email as "convertido"
    try {
      const { data: activeLeads } = await supabase.from("crm_leads").select("id")
        .eq("email", trimmedEmail).not("stage", "in", "(convertido,perdido)");
      if (activeLeads && activeLeads.length > 0) {
        for (const lead of activeLeads) {
          await supabase.from("crm_leads").update({ stage: "convertido", converted_at: new Date().toISOString() }).eq("id", lead.id);
          await supabase.from("crm_lead_activities").insert({
            lead_id: lead.id, activity_type: "stage_change",
            description: `Convertido automaticamente após compra via WooCommerce (${productName})`,
            metadata: { source: "woocommerce-webhook", product_name: productName },
          });
        }
        console.log(`Auto-converted ${activeLeads.length} CRM lead(s) for ${trimmedEmail}`);
      }
    } catch (crmErr) {
      console.error("CRM auto-conversion error:", crmErr);
    }

    // 8. Log success
    const statusDetail = alreadyHasAccess
      ? `Acesso já existia para ${productName}. Notificações reenviadas.`
      : isNewUser
        ? `Novo usuário criado e acesso liberado para ${productName}`
        : `Acesso liberado para ${productName} (usuário existente)`;

    await supabase.from("webhook_logs").insert({
      source: "woocommerce",
      product_id: trimmedId,
      product_name: productName,
      email: trimmedEmail,
      phone: telefone?.trim() || null,
      user_name: nome?.trim() || null,
      status: "success",
      status_detail: statusDetail,
      user_id: userId,
      is_new_user: isNewUser,
      already_had_access: alreadyHasAccess,
      raw_payload: body as any,
      processing_time_ms: Date.now() - startTime,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: isNewUser
          ? "User created and access granted"
          : "Access granted to existing user",
        user_id: userId,
        ...(comboData
          ? { combo_id: comboData.id, combo_name: comboData.name, courses_granted: comboCourseIds.length }
          : courseData
          ? { course_id: courseData.id, course_name: courseData.name, modules_granted: courseModuleIds.length }
          : { package_id: pkg!.id, package_name: pkg!.name }),
        is_new_user: isNewUser,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("WooCommerce webhook error:", error);

    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("webhook_logs").insert({
        source: "woocommerce",
        status: "error",
        status_detail: "Erro inesperado no processamento",
        error_message: error.message,
        processing_time_ms: Date.now() - startTime,
      });
    } catch (_) {
      // ignore logging error
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

function getDefaultTemplate(): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0a0a0a; padding: 40px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a1a1a; border-radius: 16px; padding: 40px; color: #f5f5f5;">
    <h1 style="color: #f5f5f5; margin-bottom: 24px;">Olá, {{user_name}}!</h1>
    <p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">
      Seu acesso ao módulo <strong style="color: #dc2626;">{{module_name}}</strong> foi liberado com sucesso!
    </p>
    {{password_section}}
    <p style="font-size: 16px; line-height: 1.6; color: #d4d4d4;">
      Clique no botão abaixo para acessar sua conta e começar a estudar:
    </p>
    <a href="{{login_url}}" style="background:#dc2626;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px;font-weight:bold;font-size:16px;">Acessar minha conta</a>
    <p style="font-size: 14px; color: #737373; margin-top: 32px;">
      Se tiver qualquer dúvida, responda este e-mail.
    </p>
  </div>
</body></html>`;
}

serve(handler);