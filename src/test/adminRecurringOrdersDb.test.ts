// @vitest-environment node
import { Blob as NodeBlob } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';

let db: PGlite;
const user = '00000000-0000-0000-0000-000000000010';
const migration = readFileSync('supabase/migrations/20261104080000_admin_recurring_order_dedup.sql', 'utf8');
beforeAll(async () => {
  db = new PGlite({ fsBundle: new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob });
  await db.exec(`
    SET timezone='UTC';
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '${user}'::uuid $$;
    CREATE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.admin',true)='yes' $$;
    CREATE FUNCTION is_partner(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    SET test.admin='yes';
    CREATE TABLE profiles(user_id uuid,full_name text,email text,phone text);
    CREATE TABLE partner_products(user_id uuid,product_type text,product_id uuid);
    CREATE TABLE vip_payments(id uuid,user_id uuid,amount numeric,currency text,status text,payment_method text,
      paid_at timestamptz,created_at timestamptz,refunded_at timestamptz,metadata jsonb,
      stripe_invoice_id text,stripe_payment_intent_id text,stripe_subscription_id text);
    CREATE TABLE purchases(id uuid,user_id uuid,product_id text,product_name text,product_type text,
      amount_paid numeric,currency text,status text,gateway text,transaction_id text,metadata jsonb,
      created_at timestamptz,updated_at timestamptz);
    CREATE TABLE courses(id uuid,name text,price numeric);
    CREATE TABLE ebooks(LIKE courses);CREATE TABLE combos(LIKE courses);CREATE TABLE packages(LIKE courses);
    CREATE TABLE user_courses(id uuid,user_id uuid,course_id uuid,amount numeric,currency text,source text,
      purchased_at timestamptz,refunded_at timestamptz,mercadopago_payment_id text,stripe_payment_intent_id text,stripe_session_id text);
    CREATE TABLE user_ebooks(LIKE user_courses);ALTER TABLE user_ebooks RENAME course_id TO ebook_id;
    CREATE TABLE user_combos(LIKE user_courses);ALTER TABLE user_combos RENAME course_id TO combo_id;
    CREATE TABLE user_packages(LIKE user_courses);ALTER TABLE user_packages RENAME course_id TO package_id;
    CREATE TABLE combo_courses(combo_id uuid,course_id uuid);
    CREATE TABLE combo_ebooks(combo_id uuid,ebook_id uuid);
    CREATE TABLE course_packages(course_id uuid,package_id uuid);
    INSERT INTO profiles VALUES('${user}','Buyer','buyer@example.com',null);
  `);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db?.close(); });

async function pair(n: number, payment: string, authorized: string, date: string, reference = payment, refunded = false) {
  await db.query(`INSERT INTO vip_payments(id,user_id,amount,currency,status,payment_method,paid_at,created_at,metadata,refunded_at)
    VALUES($1,$2,7,'BRL',$3,'card',$4,$4,$5,$6)`, [
    `00000000-0000-0000-0001-${String(n).padStart(12,'0')}`, user, refunded ? 'refunded' : 'paid', date,
    JSON.stringify({ source: 'mercadopago', mp_preapproval_id: 'same-subscription', mp_authorized_payment_id: authorized, purchase_transaction_id: reference }),
    refunded ? date : null,
  ]);
  await db.query(`INSERT INTO purchases(id,user_id,product_type,product_name,amount_paid,currency,status,gateway,transaction_id,metadata,created_at,updated_at)
    VALUES($1,$2,'club','Clube Mensal',7,'BRL',$3,'mercado_pago',$4,'{}',$5,$5)`, [
    `00000000-0000-0000-0002-${String(n).padStart(12,'0')}`, user, refunded ? 'refunded' : 'approved', reference, date,
  ]);
}

it('reproduces duplicated sales and fixes both list and total without deleting either ledger', async () => {
  await pair(1, 'payment-ana', 'invoice-ana', '2026-11-04T00:53:01Z');
  await pair(2, 'payment-leonardo', 'invoice-leonardo', '2026-11-02T10:47:05Z');
  const oldDefinition = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'))
    .split("vp.metadata->>'purchase_transaction_id', ").join('');
  await db.exec(oldDefinition);
  expect((await db.query('select count(*)::int n,sum(amount) total from admin_orders()')).rows[0])
    .toMatchObject({ n: 4, total: '28' });
  await db.exec(migration);
  const rows = (await db.query<any>('select * from admin_orders()')).rows;
  expect(rows).toHaveLength(2);
  expect(rows.every(r => r.id.startsWith('vip:') && r.total_count === 2)).toBe(true);
  expect(rows.reduce((sum,r) => sum + Number(r.amount),0)).toBe(14);
  expect((await db.query('select count(*)::int n from purchases')).rows[0]).toMatchObject({ n: 2 });
  expect((await db.query('select count(*)::int n from vip_payments')).rows[0]).toMatchObject({ n: 2 });
});

it('keeps genuine renewals and separate payments even with the same amount, user and subscription', async () => {
  await pair(3, 'payment-renewal', 'invoice-renewal', '2026-12-04T00:53:01Z');
  await pair(4, 'payment-other', 'invoice-other', '2026-12-04T00:53:01Z');
  const rows = (await db.query<any>(`select * from admin_orders(p_from=>'2026-12-01',p_to=>'2026-12-31')`)).rows;
  expect(rows).toHaveLength(2);
  expect(new Set(rows.map(r=>r.external_ref)).size).toBe(2);
  expect(rows.reduce((s,r)=>s+Number(r.amount),0)).toBe(14);
});

it('preserves non-guest authorized-payment purchase keys and refunds', async () => {
  await pair(5, 'actual-payment', 'invoice-nonguest', '2027-01-04', 'invoice-nonguest', true);
  const rows = (await db.query<any>(`select * from admin_orders(p_search=>'invoice-nonguest')`)).rows;
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].amount)).toBe(0);
  expect(rows[0].external_ref).toBe('invoice-nonguest');
});

it('preserves authorization and report filters', async () => {
  expect((await db.query(`select * from admin_orders(p_source=>'stripe')`)).rows).toHaveLength(0);
  expect((await db.query(`select * from admin_orders(p_product_type=>'curso')`)).rows).toHaveLength(0);
  await db.exec(`SET test.admin='no'`);
  await expect(db.query('select * from admin_orders()')).rejects.toThrow('Acesso negado');
  await db.exec(`SET test.admin='yes'`);
});

it('backfills only the independently verified payment pair, idempotently', async () => {
  await db.query(`INSERT INTO vip_payments(id,user_id,amount,currency,status,payment_method,paid_at,created_at,metadata)
    VALUES('8d3f100d-746f-4e55-a260-e162cadf3eb5',$1,7,'BRL','paid','card','2026-11-04','2026-11-04',
      '{"source":"mercadopago","mp_authorized_payment_id":"7033582554","mp_preapproval_id":"e2210cb116b14b25b0a68e215ab2a249"}')`, [user]);
  await db.query(`INSERT INTO purchases(id,user_id,product_type,product_name,amount_paid,currency,status,gateway,transaction_id,metadata,created_at)
    VALUES('f37abf45-ebca-4d77-ace9-273a69e007de',$1,'club','Monthly',7,'BRL','approved','mercado_pago','186585013621',
      '{"mp_preapproval_id":"e2210cb116b14b25b0a68e215ab2a249"}','2026-11-04')`, [user]);
  await db.exec(migration);
  await db.exec(migration);
  const row = (await db.query<any>(`select amount,status,metadata from vip_payments where id='8d3f100d-746f-4e55-a260-e162cadf3eb5'`)).rows[0];
  expect(row).toMatchObject({ amount: '7', status: 'paid', metadata: { purchase_transaction_id: '186585013621', mp_authorized_payment_id: '7033582554' } });
  expect((await db.query(`select * from admin_orders(p_search=>'186585013621')`)).rows).toHaveLength(1);
});
