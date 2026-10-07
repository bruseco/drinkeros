import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
await db.exec(`
  CREATE ROLE anon;
  CREATE ROLE authenticated;
  CREATE ROLE service_role BYPASSRLS;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users(id uuid PRIMARY KEY);
  INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS
    $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
  CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS
    $$SELECT current_setting('test.super_admin',true) = 'true'$$;
  SELECT set_config('test.super_admin','true',false);
`);
await db.exec(await readFile(new URL('../supabase/migrations/20261007120000_rand_financial_closings.sql', import.meta.url), 'utf8'));
let passed = 0;
const test = async (title, fn) => { await fn(); passed++; console.log(`PASS ${title}`); };
const report = (month, net = 9200) => ({ month, carry_months: [], net_cents: net, rand_cents: Math.round(net * .6),
  drinkeros_cents: net - Math.round(net * .6), lines: [{ payment_id: '123', original_month: '2020-09',
    net_cents: net, refund_cents: 0, tax_cents: 700 }] });
const prepare = async (month, revision, net) => (await db.query('SELECT * FROM public.prepare_rand_closing($1,$2::jsonb,$3)',
  [`${month}-01`, JSON.stringify(report(month, net)), revision])).rows[0];
const paid = (month, id) => db.query('SELECT * FROM public.mark_rand_closing_paid($1,$2::uuid)', [`${month}-01`, id]);
let september;
await test('migration and preparation save a complete draft', async () => {
  september = await prepare('2020-09', 0);
  assert.equal(september.status, 'draft');
});
await test('authenticated users cannot forge prepared financial totals', async () => {
  await db.exec('SET ROLE authenticated');
  await assert.rejects(() => prepare('2020-08', 0), /permission denied/);
  await db.exec('RESET ROLE');
});
await test('non-super-admin cannot mark paid', async () => {
  await db.exec("SELECT set_config('test.super_admin','false',false); SET ROLE authenticated");
  await assert.rejects(() => paid('2020-09', september.draft_id), /Acesso negado/);
  await db.exec("RESET ROLE; SELECT set_config('test.super_admin','true',false)");
});
await test('null or replaced draft cannot be confirmed', async () => {
  await assert.rejects(() => paid('2020-09', null), /desatualizado/);
  await assert.rejects(() => paid('2020-09', '00000000-0000-0000-0000-000000000002'), /desatualizado/);
});
await test('stale draft cannot be paid', async () => {
  await db.exec("UPDATE public.rand_financial_closings SET synced_at=now()-interval '11 minutes' WHERE month='2020-09-01'");
  await assert.rejects(() => paid('2020-09', september.draft_id), /desatualizado/);
  september = await prepare('2020-09', 0);
});
let october;
await test('settlement is atomic, immutable, and recognizes exact per-payment balance', async () => {
  october = await prepare('2020-10', 0);
  await db.exec('SET ROLE authenticated');
  const result = (await paid('2020-09', september.draft_id)).rows[0];
  assert.equal(result.status, 'paid');
  assert.ok(result.paid_at);
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT revision FROM rand_closing_state')).rows[0].revision, 1);
  assert.equal((await db.query('SELECT net_cents FROM rand_recognized_payments')).rows[0].net_cents, 9200);
});
await test('duplicate confirmation does not recognize money twice', async () => {
  await paid('2020-09', september.draft_id);
  assert.equal((await db.query('SELECT revision FROM rand_closing_state')).rows[0].revision, 1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM rand_recognized_payments')).rows[0].n, 1);
});
await test('another settled month invalidates an outstanding draft', async () => {
  await assert.rejects(() => paid('2020-10', october.draft_id), /Outro fechamento/);
  await assert.rejects(() => prepare('2020-11', 0), /Outro fechamento/);
});
await test('paid statement cannot be overwritten or updated by administrators', async () => {
  await assert.rejects(() => prepare('2020-09', 1), /já foi acertado/);
  await db.exec('SET ROLE authenticated');
  await assert.rejects(() => db.exec("UPDATE rand_financial_closings SET report='{}' WHERE month='2020-09-01'"), /permission denied/);
  await db.exec('RESET ROLE');
});
await test('closing before the fifth is blocked', async () => {
  const future = await prepare('2099-09', 1);
  await assert.rejects(() => paid('2099-09', future.draft_id), /dia 5/);
});
await test('negative balances are not registered as completed transfers', async () => {
  const negative = await prepare('2020-10', 1, -500);
  await assert.rejects(() => paid('2020-10', negative.draft_id), /Saldo negativo/);
});
await test('months cannot be settled out of order', async () => {
  const older = await prepare('2020-08', 1);
  await assert.rejects(() => paid('2020-08', older.draft_id), /mês posterior/);
});
await test('financial statements are hidden from non-super-admins through RLS', async () => {
  await db.exec("SELECT set_config('test.super_admin','false',false); SET ROLE authenticated");
  assert.equal((await db.query('SELECT * FROM rand_financial_closings')).rows.length, 0);
  await db.exec("RESET ROLE; SELECT set_config('test.super_admin','true',false)");
});
await test('negative pending month is preserved and marked as compensated when its successor is paid', async () => {
  const carriedReport = { ...report('2020-11'), carry_months: ['2020-10'] };
  const next = (await db.query('SELECT * FROM prepare_rand_closing($1,$2::jsonb,$3)',
    ['2020-11-01', JSON.stringify(carriedReport), 1])).rows[0];
  await paid('2020-11', next.draft_id);
  const old = (await db.query("SELECT * FROM rand_financial_closings WHERE month='2020-10-01'")).rows[0];
  assert.equal(old.status, 'carried');
  assert.equal(old.report.net_cents, -500);
  assert.equal(old.paid_at, null);
  assert.equal(new Date(old.carried_to).toISOString().slice(0, 10), '2020-11-01');
  await assert.rejects(() => prepare('2020-10', 2), /já foi acertado/);
});
await db.close();
console.log(`${passed} database checks passed. No production database was accessed.`);
