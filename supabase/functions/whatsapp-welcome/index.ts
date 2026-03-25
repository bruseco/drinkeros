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
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGIN_URL = "https://alunos.criminallab.com.br/login";

interface WelcomeRequest {
  phone: string;
  fullName?: string;
  email: string;
  temporaryPassword?: string;
  productNames?: string[];
  productName?: string; // backwards compat
  isNewUser: boolean;
}

async function sendZApiMessage(phone: string, message: string): Promise<any> {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const securityToken = Deno.env.get("ZAPI_SECURITY_TOKEN");

  if (!instanceId || !token || !securityToken) {
    throw new Error("Z-API credentials not configured");
  }

  const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
  const res = await fetch(zapiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Token": securityToken,
    },
    body: JSON.stringify({ phone, message }),
  });

  const resData = await res.json();
  if (!res.ok) {
    throw new Error(`Z-API error: ${res.status} ${JSON.stringify(resData)}`);
  }
  return resData;
}

function buildWelcomeMessages(data: WelcomeRequest): string[] {
  const firstName = data.fullName?.split(" ")[0] || "aluno(a)";
  const messages: string[] = [];

  // Resolve product names (support both array and single)
  const names: string[] = data.productNames && data.productNames.length > 0
    ? data.productNames
    : data.productName ? [data.productName] : [];

  // Message 1: Greeting
  messages.push(`Oi, ${firstName}! Tudo bem? 😊`);

  // Message 2: Introduction with products
  if (names.length > 1) {
    const productList = names.map(n => `- ${n}`).join("\n");
    messages.push(`Aqui é da equipe Criminal Lab! Seus acessos já estão liberados 🎉\n\n${productList}`);
  } else if (names.length === 1) {
    messages.push(`Aqui é da equipe Criminal Lab! Seu acesso ao ${names[0]} já está liberado 🎉`);
  } else {
    messages.push(`Aqui é da equipe Criminal Lab! Bem-vindo(a) à plataforma 🎉`);
  }

  // Message 3: Access credentials
  if (data.isNewUser && data.temporaryPassword) {
    messages.push(
      `Seus dados de acesso:\n\nEmail: ${data.email}\nSenha temporária: ${data.temporaryPassword}\n\nAcesse aqui: ${LOGIN_URL}\n\nRecomendamos trocar a senha no primeiro acesso!`
    );
  } else {
    messages.push(
      `Você já pode acessar com seu email ${data.email} e sua senha atual.\n\nÉ só entrar aqui: ${LOGIN_URL}`
    );
  }

  // Message 4: Closing
  messages.push(`Qualquer dúvida é só chamar aqui que a gente te ajuda! 💪`);

  return messages;
}

function randomDelay(): number {
  return Math.floor(Math.random() * 3000) + 3000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const data: WelcomeRequest = await req.json();

    if (!data.phone || !data.email) {
      throw new Error("phone and email are required");
    }

    const phone = normalizePhone(data.phone);
    const messages = buildWelcomeMessages(data);

    console.log(`[whatsapp-welcome] Sending ${messages.length} messages to ${phone}`);

    // Upsert conversation
    const { data: existingConv } = await adminClient
      .from("whatsapp_conversations")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();

    let convId: string;

    if (existingConv) {
      convId = existingConv.id;
    } else {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .eq("phone", phone)
        .maybeSingle();

      const { data: newConv, error: convError } = await adminClient
        .from("whatsapp_conversations")
        .insert({
          phone,
          profile_id: profile?.id || null,
          contact_name: data.fullName || profile?.full_name || null,
          last_message_at: new Date().toISOString(),
          last_message_preview: messages[0].substring(0, 100),
          status: "open",
          agent_mode: "ai",
        })
        .select("id")
        .single();

      if (convError) throw convError;
      convId = newConv.id;
    }

    // Send messages with delays
    for (let i = 0; i < messages.length; i++) {
      if (i > 0) {
        const delay = randomDelay();
        console.log(`[whatsapp-welcome] Waiting ${delay}ms before message ${i + 1}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      const zapiResult = await sendZApiMessage(phone, messages[i]);

      await adminClient.from("whatsapp_messages").insert({
        conversation_id: convId,
        direction: "outbound",
        message_type: "text",
        content: messages[i],
        zapi_message_id: zapiResult.messageId || zapiResult.zapiMessageId || null,
        status: "sent",
        metadata: { source: "welcome_flow" },
      });

      console.log(`[whatsapp-welcome] Message ${i + 1}/${messages.length} sent`);
    }

    await adminClient.from("whatsapp_conversations").update({
      last_message_at: new Date().toISOString(),
      last_message_preview: messages[messages.length - 1].substring(0, 100),
    }).eq("id", convId);

    console.log(`[whatsapp-welcome] All messages sent to ${phone}`);

    return new Response(JSON.stringify({ success: true, conversationId: convId, messagesSent: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-welcome] Error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
