import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) throw new Error("Forbidden: admin only");

    const { title, body, url, targetType, targetPackageId, targetCourseId, targetUserIds } = await req.json();

    if (!title || !body) throw new Error("Missing title or body");

    // Configure VAPID
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error("VAPID keys not configured");
    }

    webpush.setVapidDetails(
      "mailto:admin@criminallab.com.br",
      vapidPublicKey,
      vapidPrivateKey
    );

    // Fetch target subscriptions
    let subscriptions: any[] = [];

    if (targetType === "package" && targetPackageId) {
      const { data: userPackages } = await supabase
        .from("user_packages")
        .select("user_id")
        .eq("package_id", targetPackageId);
      const userIds = (userPackages || []).map((up: any) => up.user_id);
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("push_subscriptions")
          .select("*")
          .in("user_id", userIds);
        subscriptions = data || [];
      }
    } else if (targetType === "individual" && targetUserIds?.length > 0) {
      const { data } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", targetUserIds);
      subscriptions = data || [];
    } else {
      // Default: all
      const { data } = await supabase.from("push_subscriptions").select("*");
      subscriptions = data || [];
    }

    // Send notifications
    const payload = JSON.stringify({
      title,
      body,
      url: url || "/app",
    });

    let sentCount = 0;
    const errors: { endpoint: string; error: string }[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sentCount++;
      } catch (err: any) {
        // Remove expired/invalid subscriptions
        if (err.statusCode === 404 || err.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
        errors.push({ endpoint: sub.endpoint, error: err.message || String(err) });
      }
    }

    // Log notification
    await supabase.from("notifications").insert({
      title,
      body,
      url: url || "/app",
      target_type: targetType || "all",
      target_package_id: targetType === "package" ? targetPackageId : null,
      target_user_ids: targetType === "individual" ? targetUserIds : [],
      sent_count: sentCount,
      sent_by: user.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        totalSubscriptions: subscriptions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error sending push notification:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
