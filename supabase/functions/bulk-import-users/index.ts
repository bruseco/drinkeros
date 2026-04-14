import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserImport {
  email: string;
  name: string;
  phone: string;
  courses: string[];
  ebooks: string[];
  combos: string[];
  exclusive: boolean;
  lifetime: boolean;
  earliest_date: string;
  purchases: { date: string; id: string; type: string }[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Temporary import function - no auth check needed as it uses service role key internally

    const { users }: { users: UserImport[] } = await req.json();

    const results = {
      created: 0,
      existing: 0,
      errors: [] as string[],
    };

    for (const u of users) {
      try {
        // Check profile first
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("email", u.email)
          .maybeSingle();

        let userId: string;

        if (existingProfile) {
          userId = existingProfile.user_id;
          results.existing++;
        } else {
          const tempPassword = crypto.randomUUID().slice(0, 12);
          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: u.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: u.name },
          });

          if (createError) {
            if (createError.message?.includes("already been registered")) {
              // Try to find in profiles again (race condition) or get from auth
              const { data: retryProfile } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("email", u.email)
                .maybeSingle();
              if (retryProfile) {
                userId = retryProfile.user_id;
                results.existing++;
              } else {
                results.errors.push(`${u.email}: already registered but no profile`);
                continue;
              }
            } else {
              results.errors.push(`${u.email}: ${createError.message}`);
              continue;
            }
          } else {
            userId = newUser.user.id;
            results.created++;
          }
        }

        // Update phone on profile
        if (u.phone) {
          await supabase.from("profiles").update({ phone: u.phone }).eq("user_id", userId);
        }

        const getExpiration = (purchaseDate: string): string | null => {
          if (u.lifetime) return null;
          const d = new Date(purchaseDate);
          d.setFullYear(d.getFullYear() + 1);
          return d.toISOString();
        };

        // Build purchase date maps
        const dateMaps: Record<string, Record<string, string>> = { course: {}, ebook: {}, combo: {} };
        for (const p of u.purchases) {
          if (p.type && p.id && !dateMaps[p.type]?.[p.id]) {
            if (dateMaps[p.type]) dateMaps[p.type][p.id] = p.date;
          }
        }

        // Courses
        for (const id of u.courses) {
          const at = dateMaps.course[id] || u.earliest_date;
          const { error } = await supabase.from("user_courses").upsert(
            { user_id: userId, course_id: id, purchased_at: at, expires_at: getExpiration(at) },
            { onConflict: "user_id,course_id", ignoreDuplicates: true }
          );
          if (error && !error.message.includes("duplicate")) {
            results.errors.push(`${u.email} course ${id}: ${error.message}`);
          }
        }

        // Ebooks
        for (const id of u.ebooks) {
          const at = dateMaps.ebook[id] || u.earliest_date;
          const { error } = await supabase.from("user_ebooks").upsert(
            { user_id: userId, ebook_id: id, purchased_at: at, expires_at: getExpiration(at) },
            { onConflict: "user_id,ebook_id", ignoreDuplicates: true }
          );
          if (error && !error.message.includes("duplicate")) {
            results.errors.push(`${u.email} ebook ${id}: ${error.message}`);
          }
        }

        // Combos
        for (const id of u.combos) {
          const at = dateMaps.combo[id] || u.earliest_date;
          const { error } = await supabase.from("user_combos").upsert(
            { user_id: userId, combo_id: id, purchased_at: at, expires_at: getExpiration(at) },
            { onConflict: "user_id,combo_id", ignoreDuplicates: true }
          );
          if (error && !error.message.includes("duplicate")) {
            results.errors.push(`${u.email} combo ${id}: ${error.message}`);
          }
        }

        // Exclusive access
        if (u.exclusive) {
          await supabase.from("user_exclusive_access").upsert(
            { user_id: userId, feature: "receitas" },
            { onConflict: "user_id,feature", ignoreDuplicates: true }
          );
        }

        // Lifetime
        if (u.lifetime) {
          await supabase.from("user_lifetime_access").upsert(
            { user_id: userId },
            { onConflict: "user_id", ignoreDuplicates: true }
          );
        }
      } catch (err) {
        results.errors.push(`${u.email}: ${(err as Error).message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
