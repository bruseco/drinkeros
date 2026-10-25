import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { handleGuestCheckout } from './handler.ts';
serve(req=>handleGuestCheckout(req,{
 admin:createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}}),
 mpToken:Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')||'',
 supabaseUrl:Deno.env.get('SUPABASE_URL')!,serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
}));
