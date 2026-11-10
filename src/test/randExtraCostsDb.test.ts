// @vitest-environment node
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, afterAll, expect, it } from 'vitest';
import { calculateRandClosing } from '../../supabase/functions/_shared/randClosing';
let db: PGlite;
const report = (month: string, net = 9200, payment = 'payment-1', carry: string[] = []) => ({
  month, net_cents: net, rand_cents: Math.round(net * .6), drinkeros_cents: net - Math.round(net * .6),
  tax_base_cents: 10000, tax_cents: 700, adjustments_cents: 0, carry_months: carry,
  lines: [{ payment_id: payment, original_month: month, net_cents: net, refund_cents: 0, tax_cents: 700 }],
});
const revision = async () => (await db.query<any>('select revision from rand_closing_state')).rows[0].revision;
const prepare = async (month = '2020-09', net = 9200, payment = 'payment-1', carry: string[] = []) =>
  (await db.query<any>('select * from prepare_rand_closing($1,$2::jsonb,$3)', [`${month}-01`,JSON.stringify(report(month,net,payment,carry)),await revision()])).rows[0];
const add = async (description: string, cents: number, month = '2020-09') =>
  (await db.query<any>('select * from save_rand_closing_cost($1,$2,$3)', [`${month}-01`,description,cents])).rows[0];
beforeAll(async () => {
  db = new PGlite({ fsBundle: new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob });
  await db.exec(`SET timezone='UTC'; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.admin',true)='yes'$$; SET test.admin='yes';`);
  for (const file of ['20261007120000_rand_financial_closings.sql','20261110190000_rand_existing_settlement.sql','20261110193000_rand_extra_costs.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  }
},30000);
beforeEach(async () => { await db.exec(`RESET ROLE; SET test.admin='yes'; TRUNCATE rand_closing_costs,rand_recognized_payments,rand_financial_closings; UPDATE rand_closing_state SET revision=0;`); });
afterAll(async () => { await db?.close(); });

it('subtracts multiple named costs before the split without changing tax, then survives a gateway refresh', async () => {
  await prepare();
  await add('ManyChat',1234);
  const saved = await add('Ferramenta',4567);
  expect(saved.report).toMatchObject({ extra_costs_cents:5801, net_before_costs_cents:9200,net_cents:3399,rand_cents:2039,drinkeros_cents:1360,tax_base_cents:10000,tax_cents:700 });
  expect(saved.report.extra_costs.map((c:any)=>c.description)).toEqual(['ManyChat','Ferramenta']);
  const refreshed = await prepare();
  expect(refreshed.report.net_cents).toBe(3399);
  expect(refreshed.report.extra_costs).toHaveLength(2);
});
it('removes a draft cost reversibly and invalidates old confirmation without pretending gateway data is fresh', async () => {
  const original = await prepare();
  await db.exec(`update rand_financial_closings set synced_at='2020-10-07'`);
  const saved = await add('ManyChat',1000);
  expect(saved.synced_at).toEqual(new Date('2020-10-07Z'));
  await expect(db.query('select record_rand_closing_settled($1,$2,$3)', [original.month,original.draft_id,5520])).rejects.toThrow('demonstrativo mudou');
  const removed = (await db.query<any>('select * from save_rand_closing_cost($1,null,null,$2,true)', [original.month,saved.report.extra_costs[0].id])).rows[0];
  expect(removed.report.net_cents).toBe(9200);
  expect(removed.report.extra_costs).toHaveLength(0);
  expect((await db.query<any>('select deleted_at from rand_closing_costs')).rows[0].deleted_at).toBeTruthy();
});
it('locks costs after settlement and does not deduct them again in later months', async () => {
  await prepare();
  const saved = await add('ManyChat',1000);
  await db.query('select mark_rand_closing_paid($1,$2)', [saved.month,saved.draft_id]);
  const before = (await db.query<any>('select report from rand_financial_closings')).rows[0].report;
  await expect(add('Another cost',100)).rejects.toThrow('não pode ser alterado');
  expect((await db.query<any>('select report from rand_financial_closings')).rows[0].report).toEqual(before);
  expect((await db.query<any>('select recognized_in::text as recognized_in from rand_closing_costs')).rows[0].recognized_in).toBe('2020-09-01');
  const october = await prepare('2020-10',9200,'payment-2');
  expect(october.report.net_cents).toBe(9200);
  expect(october.report.extra_costs).toHaveLength(0);
});
it('carries a negative month cost exactly once, including through settlement', async () => {
  await prepare('2020-09',5000);
  expect((await add('Large expense',10000)).report.net_cents).toBe(-5000);
  const gatewayReport = calculateRandClosing('2020-10', [
    { payment_id:'payment-1',paid_at:'2020-09-15T12:00:00-03:00',method:'pix',gross_cents:10000,refund_cents:0,fee_cents:4300,status:'approved' },
    { payment_id:'payment-2',paid_at:'2020-10-15T12:00:00-03:00',method:'pix',gross_cents:10000,refund_cents:0,fee_cents:300,status:'approved' },
  ], [], ['2020-09']);
  const october = (await db.query<any>('select * from prepare_rand_closing($1,$2::jsonb,$3)',
    ['2020-10-01',JSON.stringify(gatewayReport),await revision()])).rows[0];
  expect(october.report).toMatchObject({ net_cents:4000,extra_costs_cents:10000,rand_cents:2400 });
  expect(october.report.extra_costs[0].carried).toBe(true);
  await db.query('select mark_rand_closing_paid($1,$2)', [october.month,october.draft_id]);
  expect((await db.query<any>('select recognized_in::text as recognized_in from rand_closing_costs')).rows[0].recognized_in).toBe('2020-10-01');
  expect((await db.query<any>('select count(*)::int n from rand_recognized_payments')).rows[0].n).toBe(2);
  expect((await prepare('2020-11',9200,'payment-3')).report.net_cents).toBe(9200);
});
it('rejects invalid inputs, other-month removals, non admins and direct client writes', async () => {
  await prepare();
  await expect(add('',100)).rejects.toThrow('descrição');
  await expect(add('ManyChat',0)).rejects.toThrow('valor positivo');
  const saved = await add('ManyChat',1000);
  await prepare('2020-10');
  await expect(db.query('select save_rand_closing_cost($1,null,null,$2,true)', ['2020-10-01',saved.report.extra_costs[0].id])).rejects.toThrow('não encontrado');
  await db.exec(`SET ROLE authenticated; SET test.admin='no'`);
  await expect(add('ManyChat',100)).rejects.toThrow('Acesso negado');
  await expect(db.exec(`insert into rand_closing_costs(month,description,amount_cents,created_by) values('2020-09-01','x',1,auth.uid())`)).rejects.toThrow('permission denied');
  await db.exec('RESET ROLE; SET ROLE anon');
  await expect(add('ManyChat',100)).rejects.toThrow('permission denied');
});
