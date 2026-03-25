import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGIN_URL = "https://alunos.criminallab.com.br/login";

function buildCredentialMessages(data: {
  fullName?: string | null;
  email: string;
  temporaryPassword?: string | null;
  productNames: string[];
  isNewUser: boolean;
}): string[] {
  const firstName = data.fullName?.split(" ")[0] || "aluno(a)";
  const messages: string[] = [];
  const names = data.productNames;

  if (names.length > 1) {
    const productList = names.map(n => `- ${n}`).join("\n");
    messages.push(`Seus acessos já estão liberados 🎉\n\n${productList}`);
  } else if (names.length === 1) {
    messages.push(`Seu acesso ao ${names[0]} já está liberado 🎉`);
  } else {
    messages.push(`Seu acesso já está liberado 🎉`);
  }

  if (data.isNewUser && data.temporaryPassword) {
    messages.push(
      `Seus dados de acesso:\n\n📧 Email: ${data.email}\n🔑 Senha temporária: ${data.temporaryPassword}\n\n👉 Acesse aqui: ${LOGIN_URL}\n\nRecomendamos trocar a senha no primeiro acesso!`
    );
  } else {
    messages.push(
      `Você já pode acessar com seu email ${data.email} e sua senha atual.\n\n👉 É só entrar aqui: ${LOGIN_URL}`
    );
  }

  messages.push(`Qualquer dúvida é só chamar aqui que a gente te ajuda! 💪`);

  return messages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ======= ERA CLOUD / WHATSAPP CLOUD API WEBHOOK VERIFICATION (GET) =======
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const verifyToken = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && verifyToken && challenge) {
      console.log("[webhook] Era Cloud verification request received");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);

      // Check if any era_cloud connection has this verify token
      const { data: connections } = await adminClient
        .from("zapi_connections")
        .select("id, security_token")
        .eq("provider", "era_cloud");

      const matched = (connections || []).some((c: any) => c.security_token === verifyToken);
      if (matched) {
        console.log("[webhook] Era Cloud verification successful");
        return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
      } else {
        console.log("[webhook] Era Cloud verification failed - token mismatch");
        return new Response("Forbidden", { status: 403 });
      }
    }

    return new Response("OK", { status: 200 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const connectionId = url.searchParams.get("connection_id");

    const payload = await req.json();
    console.log("Webhook payload:", JSON.stringify(payload));

    // ======= META CLOUD API DETECTION =======
    if (payload.object === "whatsapp_business_account") {
      for (const entry of (payload.entry || [])) {
        for (const change of (entry.changes || [])) {
          const value = change.value;
          if (!value) continue;

          // Handle status updates
          if (value.statuses) {
            for (const status of value.statuses) {
              const statusMap: Record<string, string> = {
                sent: "sent",
                delivered: "delivered",
                read: "read",
                failed: "failed",
              };
              const newStatus = statusMap[status.status];
              if (newStatus && status.id) {
                const updateData: Record<string, any> = { status: newStatus };

                // Capture error details for failed messages
                if (newStatus === "failed" && status.errors?.length > 0) {
                  const errorInfo = status.errors[0];
                  console.log(`[webhook] Message ${status.id} FAILED: code=${errorInfo.code}, title=${errorInfo.title}, details=${errorInfo.message || errorInfo.error_data?.details || ""}`);

                  // Merge error info with existing metadata
                  const { data: existingMsg } = await adminClient
                    .from("whatsapp_messages")
                    .select("id, metadata, content, conversation_id")
                    .eq("zapi_message_id", status.id)
                    .maybeSingle();

                  const existingMeta = existingMsg?.metadata && typeof existingMsg.metadata === "object" ? existingMsg.metadata as Record<string, any> : {};

                  updateData.metadata = {
                    ...existingMeta,
                    error_code: errorInfo.code,
                    error_title: errorInfo.title,
                    error_message: errorInfo.message || errorInfo.error_data?.details || null,
                  };

                  // === FALLBACK Z-API: re-enqueue undeliverable messages ===
                  const isUndeliverable = errorInfo.code === 131026 || errorInfo.code === "131026";
                  const alreadyFallback = existingMeta?.fallback_zapi === true;

                  // Welcome templates get Z-API fallback on ANY error (first contact with customer)
                  const welcomeTemplates = ['criminal_lab_confirmacao', 'abertura_confirmacao_existente'];
                  const isWelcomeTemplate = welcomeTemplates.includes(existingMeta?.template_name);
                  const shouldFallback = isUndeliverable || (isWelcomeTemplate && !!errorInfo);

                  if (shouldFallback && !alreadyFallback && existingMsg) {
                    console.log(`[webhook] ${isWelcomeTemplate ? 'Welcome template' : 'Undeliverable'} message ${status.id} (error ${errorInfo.code}) — attempting Z-API fallback`);

                    // Find an active Z-API connection for fallback
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
                      // Get conversation phone
                      const { data: conv } = await adminClient
                        .from("whatsapp_conversations")
                        .select("phone")
                        .eq("id", existingMsg.conversation_id)
                        .maybeSingle();

                      // Build fallback message: use template_body from metadata or original content
                      const fallbackMessage = existingMeta?.template_body || existingMsg.content || "";

                      if (conv?.phone && fallbackMessage) {
                        const originalContextData = existingMeta?.context_data && typeof existingMeta.context_data === "object"
                          ? existingMeta.context_data as Record<string, any>
                          : {};
                        const contextType = existingMeta?.context_type || originalContextData?.context_type || "fallback";

                        await adminClient.from("whatsapp_send_queue").insert({
                          phone: normalizePhone(conv.phone),
                          message: fallbackMessage,
                          zapi_connection_id: zapiConn.id,
                          context_type: contextType,
                          context_data: {
                            ...originalContextData,
                            fallback_zapi: true,
                            original_message_id: existingMsg.id,
                            original_wamid: status.id,
                            original_error_code: errorInfo.code,
                          },
                          max_attempts: 1,
                          priority: 5,
                          status: "pending",
                        });

                        // Register audit event
                        await adminClient.from("cs_timeline_events").insert({
                          event_type: "whatsapp_fallback",
                          event_subtype: "zapi_requeue",
                          channel: "whatsapp",
                          phone: normalizePhone(conv.phone),
                          summary: `Mensagem undeliverable (131026) re-enfileirada via Z-API fallback`,
                          metadata: {
                            original_message_id: existingMsg.id,
                            original_wamid: status.id,
                            zapi_connection_id: zapiConn.id,
                            context_type: contextType,
                          },
                        });

                        console.log(`[webhook] Fallback Z-API enqueued for phone ${conv.phone} via connection ${zapiConn.id} (error: ${errorInfo.code}, template: ${existingMeta?.template_name || 'unknown'})`);
                      } else {
                        console.log(`[webhook] Fallback skipped: no phone or message content available`);
                      }
                    } else {
                      console.log(`[webhook] No active Z-API connection found for fallback`);
                    }
                  }
                }

                await adminClient
                  .from("whatsapp_messages")
                  .update(updateData)
                  .eq("zapi_message_id", status.id);
              }
            }
          }

          // Handle incoming messages
          if (value.messages) {
            for (const msg of value.messages) {
              const phone = normalizePhone(msg.from);
              const contactName = value.contacts?.[0]?.profile?.name || null;
              const messageId = msg.id || null;

              let messageType = "text";
              let content = "";

              if (msg.type === "text" && msg.text?.body) {
                content = msg.text.body;
              } else if (msg.type === "image") {
                messageType = "image";
                content = msg.image?.url || msg.image?.id || "";
              } else if (msg.type === "audio") {
                messageType = "audio";
                content = msg.audio?.url || msg.audio?.id || "";
              } else if (msg.type === "video") {
                messageType = "video";
                content = msg.video?.url || msg.video?.id || "";
              } else if (msg.type === "document") {
                messageType = "document";
                content = msg.document?.url || msg.document?.id || "";
              } else if (msg.type === "sticker") {
                messageType = "sticker";
                content = msg.sticker?.url || msg.sticker?.id || "";
              } else if (msg.type === "button") {
                messageType = "text";
                content = msg.button?.text || msg.button?.payload || "";
              } else if (msg.type === "interactive") {
                messageType = "text";
                content = msg.interactive?.button_reply?.title
                  || msg.interactive?.list_reply?.title
                  || "";
              } else if (msg.type === "reaction") {
                continue; // skip reactions
              }

              await processInboundMessage(adminClient, phone, content, messageType, messageId, contactName, connectionId, payload);
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ======= Z-API FORMAT (existing logic) =======

    // Detect and skip group messages
    const chatId = payload.chatId || payload.from || "";
    const isGroup = payload.isGroup === true
      || payload.isGroupMsg === true
      || chatId.includes("@g.us");

    if (isGroup) {
      console.log("Group message detected, skipping:", chatId);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle message status updates
    if (payload.status && payload.type === "MessageStatusCallback") {
      const statusMap: Record<string, string> = {
        SENT: "sent",
        RECEIVED: "delivered",
        READ: "read",
        PLAYED: "read",
      };

      const newStatus = statusMap[payload.status];
      const msgId = payload.id || payload.ids?.[0] || payload.messageId;
      if (newStatus && msgId) {
        await adminClient
          .from("whatsapp_messages")
          .update({ status: newStatus })
          .eq("zapi_message_id", msgId);
        console.log(`Z-API status updated: ${msgId} → ${newStatus}`);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Skip non-message callbacks
    const nonMessageTypes = [
      "DeliveryCallback",
      "PresenceChatCallback",
      "DisconnectedCallback",
      "ConnectedCallback",
      "MessageStatusCallback",
    ];
    if (payload.type && nonMessageTypes.includes(payload.type)) {
      console.log(`Non-message callback (${payload.type}), skipping`);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Handle incoming messages (Z-API)
    const rawPhone = payload.phone || payload.chatId?.replace("@c.us", "") || payload.from?.replace("@c.us", "");
    const phone = rawPhone ? normalizePhone(rawPhone) : null;
    const text = payload.text?.message || payload.body || payload.message || "";
    const messageId = payload.messageId || payload.id?.id || payload.ids?.[0] || null;
    const senderName = payload.senderName || payload.chatName || payload.notifyName || null;
    const isFromMe = payload.fromMe === true;

    if (!phone) {
      console.log("No phone found in payload, skipping");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isFromMe) {
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine message type
    let messageType = "text";
    let content = text;
    if (payload.image) {
      messageType = "image";
      content = payload.image.imageUrl || payload.image.url || text;
    } else if (payload.audio) {
      messageType = "audio";
      content = payload.audio.audioUrl || payload.audio.url || text;
    } else if (payload.video) {
      messageType = "video";
      content = payload.video.videoUrl || payload.video.url || text;
    } else if (payload.document) {
      messageType = "document";
      content = payload.document.documentUrl || payload.document.url || text;
    } else if (payload.sticker) {
      messageType = "sticker";
      content = payload.sticker.stickerUrl || payload.sticker.url || text;
    } else if (payload.buttonsResponseMessage) {
      messageType = "text";
      content = payload.buttonsResponseMessage?.selectedButtonId
        || payload.buttonsResponseMessage?.selectedButtonText
        || text;
    }

    return await processInboundMessage(adminClient, phone, content, messageType, messageId, senderName, connectionId, payload);
  } catch (error) {
    console.error("whatsapp-webhook error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processInboundMessage(
  adminClient: any,
  phone: string,
  content: string,
  messageType: string,
  messageId: string | null,
  senderName: string | null,
  connectionId: string | null,
  rawPayload: any
): Promise<Response> {
  // Lookup profile with both phone formats (with and without +)
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  // Find or create conversation
  const { data: existingConv } = await adminClient
    .from("whatsapp_conversations")
    .select("id, unread_count, zapi_connection_id, profile_id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .maybeSingle();

  let convId: string;

  if (existingConv) {
    convId = existingConv.id;
    const updateData: any = {
      last_message_at: new Date().toISOString(),
      last_message_preview: (content || "").substring(0, 100),
      unread_count: (existingConv.unread_count || 0) + 1,
      contact_name: senderName || undefined,
      status: "open",
    };
    if (connectionId) {
      updateData.zapi_connection_id = connectionId;
    }
    if (!existingConv.profile_id && profile?.id) {
      updateData.profile_id = profile.id;
    }
    await adminClient
      .from("whatsapp_conversations")
      .update(updateData)
      .eq("id", convId);
  } else {
    const { data: newConv, error: convError } = await adminClient
      .from("whatsapp_conversations")
      .insert({
        phone,
        profile_id: profile?.id || null,
        contact_name: senderName || profile?.full_name || null,
        last_message_at: new Date().toISOString(),
        last_message_preview: (content || "").substring(0, 100),
        unread_count: 1,
        status: "open",
        zapi_connection_id: connectionId || null,
      })
      .select("id")
      .single();

    if (convError) throw convError;
    convId = newConv!.id;

    // Auto-create CRM lead in "atendimento" funnel for new inbound conversations
    try {
      const { data: existingLead } = await adminClient
        .from("crm_leads")
        .select("id")
        .eq("phone", phone)
        .eq("funnel", "atendimento")
        .not("stage", "in", "(convertido,perdido)")
        .maybeSingle();

      if (!existingLead) {
        const leadName = senderName || profile?.full_name || phone;
        const { data: newLead } = await adminClient
          .from("crm_leads")
          .insert({
            name: leadName,
            phone,
            funnel: "atendimento",
            stage: "entrada_contato_atend",
            source: "whatsapp",
            profile_id: profile?.id || null,
          })
          .select("id")
          .single();

        if (newLead) {
          await adminClient.from("crm_lead_activities").insert({
            lead_id: newLead.id,
            activity_type: "auto_created",
            description: "Lead criado automaticamente via contato WhatsApp inbound",
          });
          console.log(`[webhook] Atendimento lead created for ${phone}: ${newLead.id}`);
        }
      }
    } catch (err) {
      console.error("[webhook] Error creating atendimento lead:", err);
      // Don't throw — conversation was already created successfully
    }
  }

  // Save message
  await adminClient.from("whatsapp_messages").insert({
    conversation_id: convId,
    direction: "inbound",
    message_type: messageType,
    content,
    zapi_message_id: messageId,
    status: "delivered",
    metadata: {
      ...rawPayload,
      media_url: rawPayload?.image?.url || rawPayload?.audio?.url || rawPayload?.video?.url || rawPayload?.document?.url || rawPayload?.sticker?.url || null,
      media_mime_type: rawPayload?.image?.mime_type || rawPayload?.audio?.mime_type || rawPayload?.video?.mime_type || rawPayload?.document?.mime_type || rawPayload?.sticker?.mime_type || null,
    },
  });

  // Check for pending credentials to send (welcome flow - credentials after lead responds)
  let credentialsSent = false;
  try {
    const { data: pendingCredentials } = await adminClient
      .from("whatsapp_welcome_queue")
      .select("*")
      .in("phone", [phone, `+${phone}`])
      .eq("processed", true)
      .eq("credentials_sent", false);

    if (pendingCredentials && pendingCredentials.length > 0) {
      console.log(`[webhook] Found ${pendingCredentials.length} pending credential items for ${phone}`);

      // Re-check with lock to prevent race conditions
      const itemIds = pendingCredentials.map((item: any) => item.id);
      const { data: confirmed } = await adminClient
        .from("whatsapp_welcome_queue")
        .update({ credentials_sent: true })
        .in("id", itemIds)
        .eq("credentials_sent", false)
        .select("*");

      if (confirmed && confirmed.length > 0) {
        const productNames = confirmed.map((item: any) => item.product_name).filter(Boolean);
        const isNewUser = confirmed.some((item: any) => item.is_new_user);
        const temporaryPassword = confirmed.find((item: any) => item.is_new_user && item.temporary_password)?.temporary_password;
        const firstItem = confirmed[0];
        const firstName = firstItem.full_name?.split(" ")[0] || "aluno(a)";

        const messages = buildCredentialMessages({
          fullName: firstItem.full_name,
          email: firstItem.email,
          temporaryPassword: isNewUser ? temporaryPassword : undefined,
          productNames,
          isNewUser,
        });

        // Get connection info to send direct messages
        const resolvedConnectionId = connectionId || existingConv?.zapi_connection_id || null;
        if (resolvedConnectionId) {
          const { data: creds } = await adminClient.rpc("get_zapi_credentials", { p_connection_id: resolvedConnectionId });
          if (creds && creds.length > 0) {
            const conn = creds[0];
            for (const msg of messages) {
              try {
                let sendResult: any;
                if (conn.provider === "era_cloud") {
                  const url = `${conn.api_url}/v1/messages`;
                  const res = await fetch(url, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "X-API-Key": conn.token },
                    body: JSON.stringify({ to: phone, type: "text", text: { body: msg } }),
                  });
                  sendResult = await res.json();
                } else {
                  const zapiUrl = `https://api.z-api.io/instances/${conn.instance_id}/token/${conn.token}/send-text`;
                  const res = await fetch(zapiUrl, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Client-Token": conn.security_token || "" },
                    body: JSON.stringify({ phone, message: msg }),
                  });
                  sendResult = await res.json();
                }
                const sentMsgId = sendResult?.messages?.[0]?.id || sendResult?.messageId || null;
                // Save credential message to conversation
                await adminClient.from("whatsapp_messages").insert({
                  conversation_id: convId,
                  direction: "outbound",
                  message_type: "text",
                  content: msg,
                  zapi_message_id: sentMsgId,
                  status: "sent",
                  metadata: { source: "welcome_credentials" },
                });
                // Update conversation preview
                await adminClient
                  .from("whatsapp_conversations")
                  .update({ last_message_at: new Date().toISOString(), last_message_preview: msg.substring(0, 100) })
                  .eq("id", convId);
              } catch (sendErr) {
                console.error(`[webhook] Error sending credential message to ${phone}:`, sendErr);
              }
            }
            credentialsSent = true;
            console.log(`[webhook] Credentials sent successfully to ${phone} (${messages.length} messages)`);
          }
        }
      }
    }
  } catch (credErr) {
    console.error("[webhook] Error checking/sending pending credentials:", credErr);
  }

  // Trigger AI Agent
  try {
    const { data: agentSettings } = await adminClient
      .from("whatsapp_agent_settings")
      .select("is_enabled")
      .limit(1)
      .single();

    const { data: convData } = await adminClient
      .from("whatsapp_conversations")
      .select("agent_mode")
      .eq("id", convId)
      .single();

    if (agentSettings?.is_enabled && convData?.agent_mode === "ai" && !credentialsSent) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const messageTimestamp = new Date().toISOString();
      fetch(`${supabaseUrl}/functions/v1/agent-router`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          conversationId: convId,
          messageContent: content,
          messageType: messageType,
          messageTimestamp,
        }),
      }).catch((err) => console.error("Error calling whatsapp-agent:", err));
    }
  } catch (agentErr) {
    console.error("Error checking agent settings:", agentErr);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
