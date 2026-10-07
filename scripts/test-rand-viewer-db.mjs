import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT current_setting('test.user',true)::uuid$$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE TABLE public.purchases(id uuid PRIMARY KEY, transaction_id text, buyer_name text, user_id uuid, gateway text, product_type text);
CREATE TABLE public.profiles(user_id uuid, full_name text);
SELECT set_config('test.user','00000000-0000-0000-0000-000000000001',false);
`);
for (const file of ['20261007120000_rand_financial_closings.sql', '20261007180000_rand_closing_viewers.sql']) {
  await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'));
}
await db.exec(`
INSERT INTO rand_financial_closings(month,base_revision,report) VALUES ('2020-09-01',0,'{"lines":[{"payment_id":"rand-sale"}]}');
INSERT INTO purchases VALUES
('00000000-0000-0000-0000-000000000010','rand-sale','RAND Buyer',null,'mercado_pago','combo'),
('00000000-0000-0000-0000-000000000011','unrelated-sale','Other Buyer',null,'mercado_pago','combo');
SET ROLE authenticated;
`);
await assert.rejects(() => db.query('SELECT view_rand_closings()'), /Acesso negado/);
await db.exec("RESET ROLE; INSERT INTO rand_closing_viewers(user_id) VALUES ('00000000-0000-0000-0000-000000000001'); SET ROLE authenticated");
const rows = (await db.query('SELECT view_rand_closings() AS reports')).rows[0].reports;
assert.equal(rows.length, 1);
assert.deepEqual(rows[0].buyer_names, { 'rand-sale': 'RAND Buyer' });
assert.equal((await db.query('SELECT count(*)::int AS n FROM rand_financial_closings')).rows[0].n, 0);
await assert.rejects(() => db.query('SELECT * FROM purchases'), /permission denied/);
await assert.rejects(() => db.query('SELECT * FROM rand_closing_viewers'), /permission denied/);
await assert.rejects(() => db.query("SELECT mark_rand_closing_paid('2020-09-01',null)"), /Acesso negado/);
await assert.rejects(() => db.query("SELECT prepare_rand_closing('2020-09-01','{}',0)"), /permission denied/);
await db.exec("SELECT set_config('test.user','00000000-0000-0000-0000-000000000002',false)");
await assert.rejects(() => db.query('SELECT view_rand_closings()'), /Acesso negado/);
await db.exec('RESET ROLE; SET ROLE anon');
await assert.rejects(() => db.query('SELECT view_rand_closings()'), /permission denied/);
await db.close();
console.log('PASS: viewer scope, names, unrelated account, anonymous access and mutation denial');
