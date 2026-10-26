import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
CREATE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.admin',true),'false')='true'$$;
CREATE FUNCTION is_partner(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE TABLE purchases(product_type text,status text,amount_paid numeric,created_at timestamptz);
INSERT INTO purchases VALUES
('club','approved',87,'2026-10-25T00:00:00Z'),('club','paid',97,'2026-10-25T23:59:59Z'),
('club','approved',197,'2026-10-26T00:00:00Z'),('club','pending',87,'2026-10-25T12:00:00Z'),
('club','refunded',87,'2026-10-25T12:00:00Z'),('club','approved',0,'2026-10-25T12:00:00Z'),
('combo','approved',197,'2026-10-25T12:00:00Z');`);
await db.exec(await readFile(new URL('../supabase/migrations/20261026112000_club_purchase_funnel.sql',import.meta.url),'utf8'));
await db.exec('SET ROLE anon');await assert.rejects(()=>db.query('select get_club_purchase_funnel()'),/permission denied/);
await db.exec('RESET ROLE;SET ROLE authenticated');await assert.rejects(()=>db.query('select get_club_purchase_funnel()'),/restrito/);
await db.exec("SELECT set_config('test.admin','true',false)");
assert.equal(Number((await db.query('select get_club_purchase_funnel() as n')).rows[0].n),3);
assert.equal(Number((await db.query("select get_club_purchase_funnel('2026-10-25T00:00:00Z','2026-10-26T00:00:00Z') as n")).rows[0].n),2);
console.log('Club purchases: confirmed payments only, preset/custom periods, permission guards passed');await db.close();
