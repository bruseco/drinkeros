// @vitest-environment node
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
let db: PGlite;
let draft: any;
const report = { month: '2020-09', carry_months: [], net_cents: 383191,
  rand_cents: 229915, drinkeros_cents: 153276,
  lines: [{ payment_id: 'example-payment', original_month: '2020-09', net_cents: 383191, refund_cents: 0, tax_cents: 30338 }] };
beforeAll(async () => {
  db = new PGlite({ fsBundle: new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob });
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('00000000-0000-0000-0000-000000000001');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '00000000-0000-0000-0000-000000000001'::uuid$$;
    CREATE FUNCTION has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.admin',true)='yes'$$;
    SET test.admin='yes';`);
  await db.exec(readFileSync('supabase/migrations/20261007120000_rand_financial_closings.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261110190000_rand_existing_settlement.sql','utf8'));
  draft = (await db.query<any>(`select * from prepare_rand_closing('2020-09-01',$1::jsonb,0)`, [JSON.stringify(report)])).rows[0];
  await db.exec(`update rand_financial_closings set synced_at='2020-10-07T11:58:17Z' where month='2020-09-01'`);
}, 30000);
afterAll(async () => { await db?.close(); });
const settle = (id = draft.draft_id, amount: number | null = 229915) =>
  db.query<any>(`select * from record_rand_closing_settled('2020-09-01',$1::uuid,$2::bigint)`, [id,amount]);
it('keeps the old freshness rule for normal settlements and requires the exact historical draft and amount', async () => {
  await expect(db.query(`select mark_rand_closing_paid('2020-09-01',$1::uuid)`, [draft.draft_id])).rejects.toThrow('desatualizado');
  await expect(settle('00000000-0000-0000-0000-000000000002')).rejects.toThrow('demonstrativo mudou');
  await expect(settle(draft.draft_id, 1)).rejects.toThrow('valor confirmado');
  await expect(settle(draft.draft_id, null)).rejects.toThrow('valor confirmado');
  expect((await db.query<any>(`select status from rand_financial_closings where month='2020-09-01'`)).rows[0].status).toBe('draft');
});
it('rejects anonymous users and non administrators', async () => {
  await db.exec('SET ROLE anon');
  await expect(settle()).rejects.toThrow('permission denied');
  await db.exec(`RESET ROLE; SET test.admin='no'; SET ROLE authenticated`);
  await expect(settle()).rejects.toThrow('Acesso negado');
  await db.exec(`RESET ROLE; SET test.admin='yes'`);
});
it('still blocks future periods, negative balances and a changed ledger revision', async () => {
  const futureReport = { ...report, month: '2099-09' };
  const future = (await db.query<any>(`select * from prepare_rand_closing('2099-09-01',$1::jsonb,0)`, [JSON.stringify(futureReport)])).rows[0];
  await expect(db.query(`select record_rand_closing_settled('2099-09-01',$1::uuid,229915)`, [future.draft_id])).rejects.toThrow('dia 5');
  const negativeReport = { ...report, month: '2020-08', net_cents: -1, rand_cents: -1 };
  const negative = (await db.query<any>(`select * from prepare_rand_closing('2020-08-01',$1::jsonb,0)`, [JSON.stringify(negativeReport)])).rows[0];
  await expect(db.query(`select record_rand_closing_settled('2020-08-01',$1::uuid,-1)`, [negative.draft_id])).rejects.toThrow('Saldo negativo');
  await db.exec('update rand_closing_state set revision=1');
  await expect(settle()).rejects.toThrow('Outro fechamento');
  await db.exec('update rand_closing_state set revision=0');
});
it('records only on explicit confirmation, preserves the old report and sync date, and is idempotent', async () => {
  await db.exec('SET ROLE authenticated');
  const first = (await settle()).rows[0];
  expect(first.status).toBe('paid');
  expect(first.report).toEqual(report);
  expect(first.synced_at).toEqual(new Date('2020-10-07T11:58:17Z'));
  expect(first.paid_at).toBeTruthy();
  await settle();
  await db.exec('RESET ROLE');
  expect((await db.query<any>('select revision from rand_closing_state')).rows[0].revision).toBe(1);
  expect((await db.query<any>('select count(*)::int n from rand_recognized_payments')).rows[0].n).toBe(1);
  expect((await db.query<any>(`select net_cents from rand_recognized_payments`)).rows[0].net_cents).toBe(383191);
});
