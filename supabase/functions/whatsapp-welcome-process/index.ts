import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

const LOGIN_URL = "https://alunos.criminallab.com.br/login";

interface ConnectionInfo {
  provider: string;
  connectionId: string | null;
  token: string | null;
  apiUrl: string | null;
  instanceName: string | null;
  instanceId: string | null;
  securityToken: string | null;
}

function buildWelcomeMessages(data: {
  fullName?: string | null;
  email: string;
  temporaryPassword?: string | null;
  productNames: string[];
  isNewUser: boolean;
}): string[] {
  const firstName = data.fullName?.split(" ")[0] || "aluno(a)";
  const messages: string[] = [];
  const names = data.productNames;

  messages.push(`Oi, ${firstName}! Tudo bem? 😊`);

  if (names.length > 1) {
    const productList = names.map(n => `- ${n}`).join("\n");
    messages.push(`Aqui é da equipe Drinkeros! Seus acessos já estão liberados 🎉\n\n${productList}`);
  } else if (names.length === 1) {
    messages.push(`Aqui é da equipe Drinkeros! Seu acesso ao ${names[0]} já está liberado 🎉`);
  } else {
    messages.push(`Aqui é da equipe Drinkeros! Bem-vindo(a) à plataforma 🎉`);
  }

  if (data.isNewUser && data.temporaryPassword) {
    messages.push(
      `Seus dados de acesso:\n\nEmail: ${data.email}\nSenha temporária: ${data.temporaryPassword}\n\nAcesse aqui: ${LOGIN_URL}\n\nRecomendamos trocar a senha no primeiro acesso!`
    );
  } else {
    messages.push(
      `Você já pode acessar com seu email ${data.email} e sua senha atual.\n\nÉ só entrar aqui: ${LOGIN_URL}`
    );
  }

  messages.push(`Qualquer dúvida é só chamar aqui que a gente te ajuda! 💪`);

  return messages;
}

async function getConnectionForPhone(adminClient: any, phone: string): Promise<ConnectionInfo | null> {
  const { data: connections } = await adminClient
    .from("zapi_connections")
    .select("id")
    .eq("is_active", true)
    .limit(1);

  if (!connections || connections.length === 0) return null;

  const { data: conv } = await adminClient
    .from("whatsapp_conversations")
    .select("id, zapi_connection_id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  if (conv?.zapi_connection_id) {
    const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: conv.zapi_connection_id });
    if (creds && creds.length > 0) {
      return {
        provider: creds[0].provider || 'zapi',
        connectionId: conv.zapi_connection_id,
        token: creds[0].token,
        apiUrl: creds[0].api_url,
        instanceName: creds[0].instance_name,
        instanceId: creds[0].instance_id,
        securityToken: creds[0].security_token,
      };
    }
  }

  const isNewContact = !conv;
  const { data: connectionId, error } = await adminClient
    .rpc("select_zapi_connection", {
      p_conversation_id: conv?.id || null,
      p_is_new_contact: isNewContact,
    });

  if (error) {
    console.error("[whatsapp-welcome-process] Error selecting connection:", error.message);
    return null;
  }

  if (!connectionId) return null;

  const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: connectionId });
  if (creds && creds.length > 0) {
    return {
      provider: creds[0].provider || 'zapi',
      connectionId,
      token: creds[0].token,
      apiUrl: creds[0].api_url,
      instanceName: creds[0].instance_name,
      instanceId: creds[0].instance_id,
      securityToken: creds[0].security_token,
    };
  }

  return null;
}

async function sendTemplateMessage(
  phone: string,
  templateName: string,
  parameters: string[],
  conn: ConnectionInfo
): Promise<any> {
  const url = `${conn.apiUrl}/v1/messages`;
  const body = {
    to: phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: "pt_BR" },
      components: [
        {
          type: "body",
          parameters: parameters.map((p) => ({ type: "text", text: p })),
        },
      ],
    },
  };
  console.log(`[whatsapp-welcome-process] Sending template '${templateName}' to ${phone}:`, JSON.stringify(body));
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": conn.token! },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(`[whatsapp-welcome-process] Template response [${res.status}]:`, JSON.stringify(data));
  if (!res.ok) throw new Error(`Era Cloud API error [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function sendDirectMessage(phone: string, message: string, conn: ConnectionInfo): Promise<any> {
  if (conn.provider === 'era_cloud') {
    const url = `${conn.apiUrl}/v1/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": conn.token! },
      body: JSON.stringify({ to: phone, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Era Cloud API error [${res.status}]: ${JSON.stringify(data)}`);
    return data;
  } else {
    const zapiUrl = `https://api.z-api.io/instances/${conn.instanceId}/token/${conn.token}/send-text`;
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": conn.securityToken! },
      body: JSON.stringify({ phone, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Z-API error [${res.status}]: ${JSON.stringify(data)}`);
    return data;
  }
}

async function saveMessageToConversation(adminClient: any, phone: string, message: string, connectionId: string | null, messageId: string | null, metadata?: Record<string, any>) {
  const { data: existingConv } = await adminClient
    .from("whatsapp_conversations")
    .select("id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  let convId = existingConv?.id;
  if (!convId) {
    const cleanPhone = phone.replace(/\D/g, "");
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .or(`phone.eq.${cleanPhone},phone.eq.+${cleanPhone}`)
      .maybeSingle();

    const { data: newConv } = await adminClient
      .from("whatsapp_conversations")
      .insert({
        phone,
        profile_id: profile?.id || null,
        contact_name: profile?.full_name || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 100),
        status: "open",
        zapi_connection_id: connectionId,
      })
      .select("id")
      .single();
    convId = newConv?.id;
  } else {
    await adminClient
      .from("whatsapp_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 100),
        zapi_connection_id: connectionId || undefined,
      })
      .eq("id", convId);
  }

  if (convId) {
    const msgMeta = { source: "welcome_flow", ...(metadata || {}) };
    await adminClient.from("whatsapp_messages").insert({
      conversation_id: convId,
      direction: "outbound",
      message_type: metadata?.template_name ? "template" : "text",
      content: message,
      zapi_message_id: messageId,
      status: "sent",
      metadata: msgMeta,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[whatsapp-welcome-process] Processing queue (triggered by cron)...");

    const { data: pendingItems, error: fetchError } = await adminClient
      .rpc("claim_whatsapp_welcome_items");

    if (fetchError) {
      throw new Error(`Failed to claim queue items: ${fetchError.message}`);
    }

    const hasPendingItems = pendingItems && pendingItems.length > 0;
    if (!hasPendingItems) {
      console.log("[whatsapp-welcome-process] No pending items to process");
    }

    let totalQueued = 0;
    let totalSentDirect = 0;

    if (hasPendingItems) {
    // Group by phone number
    const grouped: Record<string, any[]> = {};
    for (const item of pendingItems!) {
      const phone = item.phone;
      if (!grouped[phone]) grouped[phone] = [];
      grouped[phone].push(item);
    }

    console.log(`[whatsapp-welcome-process] Processing ${pendingItems!.length} items for ${Object.keys(grouped).length} phone(s)`);

    for (const [phone, items] of Object.entries(grouped)) {
      const firstItem = items[0];
      const productNames = items.map((item: any) => item.product_name).filter(Boolean);
      const isNewUser = items.some((item: any) => item.is_new_user);
      const temporaryPassword = items.find((item: any) => item.is_new_user && item.temporary_password)?.temporary_password;

      const normalizedPhone = normalizePhone(phone);

      const connInfo = await getConnectionForPhone(adminClient, normalizedPhone);

      const messages = buildWelcomeMessages({
        fullName: firstItem.full_name,
        email: firstItem.email,
        temporaryPassword: isNewUser ? temporaryPassword : undefined,
        productNames,
        isNewUser,
      });

      // Era Cloud API: send via template (bypasses 24h window)
      if (connInfo && connInfo.provider === 'era_cloud') {
        const firstName = firstItem.full_name?.split(" ")[0] || "aluno(a)";
        const productText = productNames.length > 1
          ? productNames.join(", ")
          : productNames[0] || "Drinkeros";

        const processKey = isNewUser ? "welcome_new" : "welcome_existing";

        // Resolve template binding dynamically
        const variableValues: Record<string, string> = {
          student_name: firstName,
          product_name: productText,
          email: firstItem.email,
          password: temporaryPassword || "",
          login_url: LOGIN_URL,
        };

        const { data: binding } = await adminClient
          .from("whatsapp_template_bindings")
          .select("template_name, variable_map")
          .eq("connection_id", connInfo.connectionId)
          .eq("process", processKey)
          .eq("is_active", true)
          .maybeSingle();

        // Fallback to hardcoded names if no binding configured
        const templateName = binding?.template_name || (isNewUser ? "boas_vindas_novo_aluno" : "boas_vindas_aluno");
        const varMap = (binding?.variable_map || {}) as Record<string, string>;

        let parameters: string[];
        if (Object.keys(varMap).length > 0) {
          const maxIdx = Math.max(...Object.keys(varMap).map(Number));
          parameters = [];
          for (let i = 1; i <= maxIdx; i++) {
            const sysVar = varMap[String(i)] || "";
            parameters.push(variableValues[sysVar] || "");
          }
        } else {
          // Fallback: hardcoded params
          parameters = isNewUser && temporaryPassword
            ? [firstName, productText, firstItem.email, temporaryPassword]
            : [firstName, productText, firstItem.email];
        }

        try {
          let responseData: any;
          responseData = await sendTemplateMessage(normalizedPhone, templateName, parameters, connInfo);
          const templateContent = `[Template ${templateName}] ${parameters.filter(p => p && !p.includes("@")).join(", ")}`;

          // Render template body from DB
          let templateMeta: Record<string, any> = { template_name: templateName };
          const { data: tplData } = await adminClient
            .from("whatsapp_templates")
            .select("components")
            .eq("connection_id", connInfo.connectionId)
            .eq("name", templateName)
            .maybeSingle();
          if (tplData?.components && Array.isArray(tplData.components)) {
            for (const comp of tplData.components as any[]) {
              if (comp.type === "BODY" && comp.text) {
                let body = comp.text as string;
                parameters.forEach((p, i) => { body = body.replace(`{{${i + 1}}}`, p); });
                templateMeta.template_body = body;
              }
              if (comp.type === "HEADER" && comp.text) {
                templateMeta.template_header = comp.text;
              }
            }
          }

          const messageId = responseData.messages?.[0]?.id || responseData.messageId || null;
          await saveMessageToConversation(adminClient, normalizedPhone, templateContent, connInfo.connectionId, messageId, templateMeta);
          totalSentDirect++;
          console.log(`[whatsapp-welcome-process] Template '${templateName}' sent successfully to ${phone}`);

          const itemIds = items.map((item: any) => item.id);

          // Marcar credentials_sent = false para que o webhook envie após resposta do aluno
          await adminClient
            .from("whatsapp_welcome_queue")
            .update({ credentials_sent: false })
            .in("id", itemIds);
          console.log(`[whatsapp-welcome-process] Marked ${itemIds.length} items as credentials_sent=false for ${phone} (webhook will send credentials after reply)`);
        } catch (sendErr) {
          console.error(`[whatsapp-welcome-process] Failed to send template to ${phone}:`, sendErr);

          // === Z-API FALLBACK: re-enqueue via Z-API for welcome templates ===
          const { data: zapiConn } = await adminClient
            .from("zapi_connections")
            .select("id")
            .eq("provider", "zapi")
            .eq("is_active", true)
            .neq("connection_status", "disconnected")
            .order("new_contacts_today", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (zapiConn) {
            // Render the template body for plain-text Z-API send
            const fallbackMessage = messages.join("\n\n");
            console.log(`[whatsapp-welcome-process] Z-API fallback: re-enqueuing for ${phone} via connection ${zapiConn.id}`);

            await adminClient.from("whatsapp_send_queue").insert({
              phone: normalizedPhone,
              message: fallbackMessage,
              zapi_connection_id: zapiConn.id,
              context_type: "welcome",
              context_data: {
                fallback_zapi: true,
                original_template: templateName,
                full_name: firstItem.full_name,
                email: firstItem.email,
                product_names: productNames,
                is_new_user: isNewUser,
                source: "welcome_flow_fallback",
              },
              max_attempts: 2,
              priority: 10,
              status: "pending",
            });

            // Audit event
            await adminClient.from("cs_timeline_events").insert({
              event_type: "whatsapp_fallback",
              event_subtype: "zapi_requeue_welcome",
              channel: "whatsapp",
              phone: normalizedPhone,
              summary: `Template '${templateName}' falhou no envio inicial — re-enfileirado via Z-API`,
              metadata: {
                original_template: templateName,
                zapi_connection_id: zapiConn.id,
                error: String(sendErr),
              },
            });

            totalQueued++;
          } else {
            // No Z-API available — fallback to plain text via Era Cloud
            console.log(`[whatsapp-welcome-process] No Z-API connection available, falling back to text messages for ${phone}`);
            for (const message of messages) {
              try {
                const responseData = await sendDirectMessage(normalizedPhone, message, connInfo);
                const messageId = responseData.messages?.[0]?.id || responseData.messageId || null;
                await saveMessageToConversation(adminClient, normalizedPhone, message, connInfo.connectionId, messageId);
                totalSentDirect++;
              } catch (fallbackErr) {
                console.error(`[whatsapp-welcome-process] Text fallback also failed for ${phone}:`, fallbackErr);
              }
            }
          }
        }
        continue;
      }

      // Z-API: enqueue with delays (anti-ban)
      const now = Date.now();
      const queueInserts = messages.map((message, index) => ({
        phone: normalizedPhone,
        message,
        context_type: "welcome",
        priority: 10,
        context_data: {
          full_name: firstItem.full_name,
          email: firstItem.email,
          product_names: productNames,
          is_new_user: isNewUser,
          message_index: index,
          total_messages: messages.length,
          source: "welcome_flow",
        },
        scheduled_at: new Date(now + index * 20000).toISOString(),
        status: "pending",
        zapi_connection_id: connInfo?.connectionId || null,
      }));

      const { error: insertError } = await adminClient
        .from("whatsapp_send_queue")
        .insert(queueInserts);

      if (insertError) {
        console.error(`[whatsapp-welcome-process] Failed to queue messages for ${phone}:`, insertError);
      } else {
        console.log(`[whatsapp-welcome-process] Queued ${messages.length} messages for ${phone} (Z-API)`);
        totalQueued += messages.length;
      }
    }

    console.log(`[whatsapp-welcome-process] Done. Queued: ${totalQueued}, Sent direct: ${totalSentDirect}`);
    } // end if (hasPendingItems)

    // === SECOND PASS: send credentials for stale items where user already replied ===
    let staleCredentialsSent = 0;
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const { data: staleItems } = await adminClient
        .from("whatsapp_welcome_queue")
        .select("*")
        .eq("processed", true)
        .eq("credentials_sent", false)
        .lt("created_at", fiveMinutesAgo)
        .order("created_at", { ascending: true })
        .limit(50);

      if (staleItems && staleItems.length > 0) {
        console.log(`[whatsapp-welcome-process] Found ${staleItems.length} stale items without credentials`);

        // Group by normalized phone
        const staleGrouped: Record<string, any[]> = {};
        for (const item of staleItems) {
          const np = normalizePhone(item.phone);
          if (!staleGrouped[np]) staleGrouped[np] = [];
          staleGrouped[np].push(item);
        }

        // Limit to 5 phones per cycle
        const phonesToProcess = Object.keys(staleGrouped).slice(0, 5);
        console.log(`[whatsapp-welcome-process] Processing stale credentials for ${phonesToProcess.length} phone(s)`);

        for (const stalePhone of phonesToProcess) {
          const stalePhoneItems = staleGrouped[stalePhone];

          try {
            // Check if user has sent any inbound message
            const { data: convData } = await adminClient
              .from("whatsapp_conversations")
              .select("id, agent_mode")
              .or(`phone.eq.${stalePhone},phone.eq.+${stalePhone}`)
              .maybeSingle();

            if (!convData) {
              console.log(`[whatsapp-welcome-process] No conversation found for ${stalePhone}, skipping`);
              continue;
            }

            // If conversation is in AI or human mode, skip — credentials are already handled
            if (convData.agent_mode === 'ai' || convData.agent_mode === 'human') {
              console.log(`[whatsapp-welcome-process] Conversation ${convData.id} is in ${convData.agent_mode} mode, skipping credentials (already handled)`);
              const staleIds = stalePhoneItems.map((i: any) => i.id);
              await adminClient
                .from("whatsapp_welcome_queue")
                .update({ credentials_sent: true })
                .in("id", staleIds);
              continue;
            }

            // === CHECK 1: Verify if user already accessed the platform ===
            const { data: profileData } = await adminClient
              .from("profiles")
              .select("user_id")
              .or(`phone.eq.${stalePhone},phone.eq.+${stalePhone}`)
              .maybeSingle();

            if (profileData?.user_id) {
              const { count: viewCount } = await adminClient
                .from("recipe_views")
                .select("id", { count: "exact", head: true })
                .eq("user_id", profileData.user_id)
                .limit(1);

              if (viewCount && viewCount > 0) {
                console.log(`[whatsapp-welcome-process] User ${stalePhone} already accessed the platform, marking credentials_sent = true`);
                const staleIds = stalePhoneItems.map((i: any) => i.id);
                await adminClient.from("whatsapp_welcome_queue")
                  .update({ credentials_sent: true })
                  .in("id", staleIds);
                continue;
              }
            }

            // Check for inbound message WITHIN the last 24 hours (Meta 24h window rule)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: inboundMsg } = await adminClient
              .from("whatsapp_messages")
              .select("id")
              .eq("conversation_id", convData.id)
              .eq("direction", "inbound")
              .gte("created_at", twentyFourHoursAgo)
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            // === SAFETY CHECK: If credentials were already sent via welcome_flow or retry, skip ===
            const { data: existingCredMsg } = await adminClient
              .from("whatsapp_messages")
              .select("id")
              .eq("conversation_id", convData.id)
              .eq("direction", "outbound")
              .or("metadata->>source.eq.welcome_credentials_retry,metadata->>source.eq.welcome_flow")
              .limit(1);

            if (existingCredMsg && existingCredMsg.length >= 1) {
              console.log(`[whatsapp-welcome-process] Credentials already sent to ${stalePhone} via welcome_flow/retry, marking credentials_sent = true`);
              const staleIds = stalePhoneItems.map((i: any) => i.id);
              await adminClient.from("whatsapp_welcome_queue")
                .update({ credentials_sent: true })
                .in("id", staleIds);
              continue;
            }

            if (!inboundMsg) {
              // === CHECK 2: Limit reopen to max 1 attempt (count ALL reopens, not just last 24h) ===
              const { count: reopenCount } = await adminClient
                .from("whatsapp_messages")
                .select("id", { count: "exact", head: true })
                .eq("conversation_id", convData.id)
                .eq("direction", "outbound")
                .filter("metadata->>source", "eq", "welcome_reopen");

              if (reopenCount && reopenCount >= 1) {
                console.log(`[whatsapp-welcome-process] Already sent ${reopenCount} reopen template(s) to ${stalePhone}, marking credentials_sent = true`);
                const staleIds = stalePhoneItems.map((i: any) => i.id);
                await adminClient.from("whatsapp_welcome_queue")
                  .update({ credentials_sent: true })
                  .in("id", staleIds);
                continue;
              }

              // 24h window is closed — resend welcome template to reopen conversation
              console.log(`[whatsapp-welcome-process] 24h window closed for ${stalePhone}, resending welcome template`);
              const connInfo = await getConnectionForPhone(adminClient, stalePhone);
              if (connInfo && connInfo.provider === 'era_cloud') {
                try {
                  const firstItem = stalePhoneItems[0];
                  const firstName = firstItem.full_name?.split(" ")[0] || "aluno(a)";
                  const productNames = stalePhoneItems.map((i: any) => i.product_name).filter(Boolean);
                  const productText = productNames.length > 1 ? productNames.join(", ") : productNames[0] || "Drinkeros";
                  const isNewUser = stalePhoneItems.some((i: any) => i.is_new_user);
                  const tempPass = stalePhoneItems.find((i: any) => i.is_new_user && i.temporary_password)?.temporary_password;
                  const processKey = isNewUser ? "welcome_new" : "welcome_existing";

                  const variableValues: Record<string, string> = {
                    student_name: firstName,
                    product_name: productText,
                    email: firstItem.email,
                    password: tempPass || "",
                    login_url: LOGIN_URL,
                  };

                  const { data: binding } = await adminClient
                    .from("whatsapp_template_bindings")
                    .select("template_name, variable_map")
                    .eq("connection_id", connInfo.connectionId)
                    .eq("process", processKey)
                    .eq("is_active", true)
                    .maybeSingle();

                  const templateName = binding?.template_name || (isNewUser ? "boas_vindas_novo_aluno" : "boas_vindas_aluno");
                  const varMap = (binding?.variable_map || {}) as Record<string, string>;

                  let parameters: string[];
                  if (Object.keys(varMap).length > 0) {
                    const maxIdx = Math.max(...Object.keys(varMap).map(Number));
                    parameters = [];
                    for (let i = 1; i <= maxIdx; i++) {
                      const sysVar = varMap[String(i)] || "";
                      parameters.push(variableValues[sysVar] || "");
                    }
                  } else {
                    parameters = isNewUser && tempPass
                      ? [firstName, productText, firstItem.email, tempPass]
                      : [firstName, productText, firstItem.email];
                  }

                  const responseData = await sendTemplateMessage(stalePhone, templateName, parameters, connInfo);
                  const templateContent = `[Template ${templateName}] ${parameters.filter(p => p && !p.includes("@")).join(", ")}`;
                  const messageId = responseData.messages?.[0]?.id || responseData.messageId || null;
                  await saveMessageToConversation(adminClient, stalePhone, templateContent, connInfo.connectionId, messageId, { template_name: templateName, source: "welcome_reopen" });
                  console.log(`[whatsapp-welcome-process] Resent welcome template to ${stalePhone} to reopen 24h window`);
                } catch (tplErr) {
                  console.error(`[whatsapp-welcome-process] Failed to resend template to ${stalePhone}:`, tplErr);
                }
              }
              continue; // Don't mark credentials_sent — wait for user to reply again
            }

            // User has replied within 24h — send credentials now
            const firstItem = stalePhoneItems[0];
            const productNames = stalePhoneItems.map((i: any) => i.product_name).filter(Boolean);
            const isNewUser = stalePhoneItems.some((i: any) => i.is_new_user);
            const tempPass = stalePhoneItems.find((i: any) => i.is_new_user && i.temporary_password)?.temporary_password;

            const connInfo = await getConnectionForPhone(adminClient, stalePhone);
            if (!connInfo) {
              console.error(`[whatsapp-welcome-process] No connection for ${stalePhone}, skipping`);
              continue;
            }

            // Build credential messages
            const credMessages: string[] = [];
            const firstName = firstItem.full_name?.split(" ")[0] || "aluno(a)";

            if (productNames.length > 1) {
              const productList = productNames.map((n: string) => `• ${n}`).join("\n");
              credMessages.push(`${firstName}, seus acessos estão liberados! 🎉\n\n${productList}`);
            } else if (productNames.length === 1) {
              credMessages.push(`${firstName}, seu acesso ao *${productNames[0]}* está liberado! 🎉`);
            } else {
              credMessages.push(`${firstName}, seu acesso está liberado! 🎉`);
            }

            if (isNewUser && tempPass) {
              credMessages.push(
                `Seus dados de acesso:\n\n📧 Email: ${firstItem.email}\n🔑 Senha temporária: ${tempPass}\n\n👉 Acesse aqui: ${LOGIN_URL}\n\nRecomendamos trocar a senha no primeiro acesso!`
              );
            } else {
              credMessages.push(
                `Acesse com seu email *${firstItem.email}* e sua senha atual.\n\n👉 ${LOGIN_URL}`
              );
            }

            credMessages.push(`Qualquer dúvida, é só chamar aqui! 💪`);

            // Send each credential message and track failures
            let allFailed = true;
            for (const msg of credMessages) {
              try {
                const responseData = await sendDirectMessage(stalePhone, msg, connInfo);
                const messageId = responseData.messages?.[0]?.id || responseData.messageId || null;
                await saveMessageToConversation(adminClient, stalePhone, msg, connInfo.connectionId, messageId, { source: "welcome_credentials_retry" });
                allFailed = false;
              } catch (sendErr) {
                console.error(`[whatsapp-welcome-process] Failed to send credential msg to ${stalePhone}:`, sendErr);
              }
            }

            if (allFailed) {
              console.error(`[whatsapp-welcome-process] ALL credential messages failed for ${stalePhone}, NOT marking credentials_sent`);
              continue;
            }

            // Mark all items for this phone as credentials_sent
            const staleIds = stalePhoneItems.map((i: any) => i.id);
            await adminClient
              .from("whatsapp_welcome_queue")
              .update({ credentials_sent: true })
              .in("id", staleIds);

            staleCredentialsSent += staleIds.length;
            console.log(`[whatsapp-welcome-process] Sent stale credentials to ${stalePhone} (${staleIds.length} items)`);
          } catch (phoneErr) {
            console.error(`[whatsapp-welcome-process] Error processing stale phone ${stalePhone}:`, phoneErr);
          }
        }
      }
    } catch (staleErr) {
      console.error("[whatsapp-welcome-process] Error in stale credentials pass:", staleErr);
    }

    console.log(`[whatsapp-welcome-process] Final summary - Queued: ${totalQueued}, Sent direct: ${totalSentDirect}, Stale credentials: ${staleCredentialsSent}`);

    return new Response(JSON.stringify({ success: true, processed: pendingItems?.length || 0, queued: totalQueued, sent_direct: totalSentDirect, stale_credentials_sent: staleCredentialsSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-welcome-process] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
