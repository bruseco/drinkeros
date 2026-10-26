import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
CREATE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.admin',true),'false')='true'$$;
CREATE FUNCTION is_partner(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE TABLE club_guest_checkouts(id uuid PRIMARY KEY);
CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),gateway text,product_type text,status text,amount_paid numeric,created_at timestamptz,transaction_id text,metadata jsonb);
INSERT INTO club_guest_checkouts VALUES ('11111111-1111-4111-8111-111111111111');`);
await db.exec(await readFile(new URL('../supabase/migrations/20261026152000_club_ab_purchases.sql',import.meta.url),'utf8'));
await db.exec(`INSERT INTO club_ab_attributions(variant,guest_checkout_id) VALUES ('a','11111111-1111-4111-8111-111111111111');
INSERT INTO club_ab_attributions(variant,preapproval_id) VALUES ('b','subscription-b');
INSERT INTO club_ab_attributions(variant,payment_id) VALUES ('b','pix-b');
INSERT INTO purchases(gateway,product_type,status,amount_paid,created_at,transaction_id,metadata) VALUES
('mercado_pago','club','approved',87,'2026-10-25T10:00Z','guest-first','{"guest_checkout_id":"11111111-1111-4111-8111-111111111111"}'),
('mercado_pago','club','approved',87,'2027-10-25T10:00Z','guest-renewal','{"guest_checkout_id":"11111111-1111-4111-8111-111111111111"}'),
('mercado_pago','club','paid',87,'2026-10-25T11:00Z','card-first','{"mp_preapproval_id":"subscription-b"}'),
('mercado_pago','club','approved',87,'2026-10-26T00:00Z','pix-b','{}'),
('mercado_pago','club','approved',87,'2026-10-25T11:00Z','unattributed','{}'),
('mercado_pago','club','pending',87,'2026-10-24T10:00Z','card-pending','{"mp_preapproval_id":"subscription-b"}');`);
await db.exec('SET ROLE anon');await assert.rejects(()=>db.query('select * from get_club_ab_purchases()'),/permission denied/);await assert.rejects(()=>db.query('select * from club_ab_attributions'),/permission denied/);
await db.exec('RESET ROLE;SET ROLE authenticated');await assert.rejects(()=>db.query('select * from get_club_ab_purchases()'),/restrito/);
await db.exec("SELECT set_config('test.admin','true',false)");
const counts=async(since=null,until=null)=>Object.fromEntries((await db.query('select * from get_club_ab_purchases($1,$2)',[since,until])).rows.map(r=>[r.variant,Number(r.purchases)]));
assert.deepEqual(await counts(),{a:1,b:2});
assert.deepEqual(await counts('2026-10-25T00:00Z','2026-10-26T00:00Z'),{a:1,b:1});
assert.deepEqual(await counts('2027-10-25T00:00Z','2027-10-26T00:00Z'),{a:0,b:0});
console.log('A/B purchases: trusted confirmations, separate variants, no renewals/unattributed payments, date boundaries and access guards passed');await db.close();
