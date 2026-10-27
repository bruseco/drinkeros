// @vitest-environment node
import { Blob as NodeBlob } from "node:buffer";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
let db: PGlite;
const h = "a".repeat(64);
const quote = async (product = "xperience", activate = true) =>
  (await db.query<any>("select * from quiz_quote($1,$2,$3)", [
    h,
    product,
    activate,
  ])).rows[0];
beforeAll(async () => {
  db = new PGlite({
    fsBundle: new NodeBlob([
      readFileSync("node_modules/@electric-sql/pglite/dist/pglite.data"),
    ]) as unknown as Blob,
  });
  await db.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role; CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT null::uuid$$; CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.admin',true)='yes'$$; CREATE TABLE page_funnel_events(page_key text,event text,session_id text,metadata jsonb,created_at timestamptz default now());
 CREATE TABLE crm_leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,phone text,source text,funnel text,stage text,product_type text,product_name text,sale_value numeric,metadata jsonb,converted_at timestamptz,created_at timestamptz default now());
 CREATE TABLE purchases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),gateway text,transaction_id text,product_id uuid,product_type text,amount_paid numeric,status text,metadata jsonb,meta_capi_sent_at timestamptz,meta_capi_event_time bigint,created_at timestamptz default now());`,
  );
  for (
    const file of [
      "20261027190000_quiz_exclusive_offers.sql",
      "20261027190100_quiz_consented_leads.sql",
      "20261027190200_quiz_admin_reporting.sql",
    ]
  ) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.query("select quiz_complete($1,$2,$3,$4,$5)", [
    h,
    "casa",
    "xperience",
    JSON.stringify({ q1: "A", q2_casa: "C" }),
    JSON.stringify({ utm_content: "original" }),
  ]);
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("server quiz offers", () => {
  it("starts on arrival, preserves deadline on reload and plan B, rejects unrelated products", async () => {
    await expect(quote("xperience", false)).rejects.toThrow();
    const first = await quote();
    expect(Number(first.price)).toBe(197);
    expect(first.active).toBe(true);
    expect(Number((await quote("clube")).price)).toBe(87);
    expect((await quote()).expires_at).toEqual(first.expires_at);
    await expect(quote("eventos")).rejects.toThrow("Produto não pertence");
    await db.query("select quiz_complete($1,$2,$3,$4,$5)", [
      h,
      "empreender",
      "eventos",
      "{}",
      "{}",
    ]);
    const alternative =
      (await db.query<any>("select * from quiz_quote($1,$2,$3)", [
        h,
        "eventos",
        true,
      ])).rows[0];
    expect(alternative.recommended).toBe("eventos");
    expect(alternative.expires_at).toEqual(first.expires_at);
    expect(alternative.attribution.utm_content).toBe("original");
    await db.query("select quiz_complete($1,$2,$3,$4,$5)", [
      h,
      "casa",
      "xperience",
      JSON.stringify({ q1: "A", q2_casa: "C" }),
      "{}",
    ]);
  });
  it("requires consent, deduplicates submissions and stores original attribution", async () => {
    await expect(
      db.query("select * from quiz_capture_lead($1,$2,$3,$4,$5)", [
        h,
        "xperience",
        "Pessoa Teste",
        "5548999999999",
        false,
      ]),
    ).rejects.toThrow("Consentimento");
    const a =
      (await db.query<any>("select * from quiz_capture_lead($1,$2,$3,$4,$5)", [
        h,
        "xperience",
        "Pessoa Teste",
        "5548999999999",
        true,
      ])).rows[0];
    const b =
      (await db.query<any>("select * from quiz_capture_lead($1,$2,$3,$4,$5)", [
        h,
        "xperience",
        "Pessoa Teste",
        "5548999999999",
        true,
      ])).rows[0];
    expect(a.event_id).toBe(b.event_id);
    expect((await db.query<any>("select * from crm_leads")).rows).toHaveLength(
      1,
    );
    expect(
      (await db.query<any>("select metadata from crm_leads")).rows[0].metadata
        .attribution.utm_content,
    ).toBe("original");
  });
  it("attributes only matching confirmed payments and preserves Purchase control fields", async () => {
    const q = await quote(), productId = "11111111-1111-4111-8111-111111111111";
    await db.query(
      "insert into quiz_payment_attributions(gateway,transaction_id,session_id,product,product_id,amount,path,attribution) values($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        "mercado_pago",
        "payment-1",
        q.session_id,
        "xperience",
        productId,
        197,
        "casa",
        JSON.stringify({ utm_content: "original" }),
      ],
    );
    await db.query(
      `insert into purchases(gateway,transaction_id,product_id,product_type,amount_paid,status,metadata,meta_capi_event_time) values('mercado_pago','payment-1',$1,'course',197,'approved','{}',123)`,
      [productId],
    );
    const p = (await db.query<any>("select * from purchases")).rows[0];
    expect(p.metadata.quiz_product).toBe("xperience");
    expect(p.metadata.utm_content).toBe("original");
    expect(p.meta_capi_event_time).toBe(123);
    expect(p.meta_capi_sent_at).toBeNull();
    expect((await db.query<any>("select stage from crm_leads")).rows[0].stage)
      .toBe("convertido");
  });
  it("claims only one charge attempt and restricts raw leads to admins", async () => {
    const q = await quote();
    const claim = () =>
      db.query<any>("select quiz_claim_payment($1,$2,$3,$4) as claimed", [
        "b".repeat(64),
        q.session_id,
        "xperience",
        197,
      ]);
    expect((await claim()).rows[0].claimed).toBe(true);
    expect((await claim()).rows[0].claimed).toBe(false);
    await expect(db.query("select * from quiz_admin_leads()")).rejects.toThrow(
      "Acesso restrito",
    );
    await db.exec("set test.admin='yes'");
    const leads =
      (await db.query<any>("select * from quiz_admin_leads()")).rows;
    expect(leads).toHaveLength(1);
    expect(leads[0].purchased).toBe(true);
    expect(
      (await db.query<any>(
        "select * from quiz_admin_metrics() where event='quiz_purchase'",
      )).rows[0].count,
    ).toBe(1);
    await db.exec("set test.admin='no'");
  });
  it("uses the configured full price after expiry without renewing on repeat arrival", async () => {
    await db.exec(
      `update quiz_offer_sessions set arrived_at=now()-interval '21 minutes',expires_at=now()-interval '1 minute'`,
    );
    const q = await quote();
    expect(q.active).toBe(false);
    expect(Number(q.price)).toBe(497);
    expect(Number((await quote("clube")).price)).toBe(97);
  });
  it("does not expose sessions, leads or pricing functions to anonymous callers", async () => {
    const r = (await db.query<any>(
      `select has_table_privilege('anon','quiz_offer_sessions','select') as can_read,has_function_privilege('anon','quiz_quote(text,text,boolean)','execute') as can_quote`,
    )).rows[0];
    expect(r.can_read).toBe(false);
    expect(r.can_quote).toBe(false);
  });
});
