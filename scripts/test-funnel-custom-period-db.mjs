import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT NULL::uuid$$;
CREATE FUNCTION is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.admin',true),'false')='true'$$;
CREATE FUNCTION is_partner(uuid) RETURNS boolean LANGUAGE sql AS $$SELECT false$$;
CREATE TABLE page_funnel_events(page_key text,event text,session_id text,metadata jsonb,created_at timestamptz);
CREATE TABLE combos(id uuid,name text,slug text);CREATE TABLE courses(id uuid,title text,slug text);CREATE TABLE ebooks(id uuid,title text,slug text);CREATE TABLE packages(id uuid,title text,slug text);
CREATE TABLE purchases(status text,product_type text,product_id text,product_name text,created_at timestamptz,amount_paid numeric);
INSERT INTO page_funnel_events VALUES
('quiz','quiz_q1_answered','before','{"answer":"A"}','2026-10-01T02:59:59Z'),
('quiz','quiz_q1_answered','start','{"answer":"A"}','2026-10-01T03:00:00Z'),
('quiz','quiz_q1_answered','start','{"answer":"A"}','2026-10-01T03:00:01Z'),
('quiz','quiz_q1_answered','last','{"answer":"B"}','2026-10-03T02:59:59Z'),
('quiz','quiz_q1_answered','end','{"answer":"C"}','2026-10-03T03:00:00Z');
INSERT INTO combos VALUES('00000000-0000-0000-0000-000000000001','RAND','rand');
INSERT INTO purchases VALUES
('approved','combo','00000000-0000-0000-0000-000000000001','RAND','2026-10-01T03:00:00Z',197),
('approved','combo','00000000-0000-0000-0000-000000000001','RAND','2026-10-03T03:00:00Z',197);`);
await db.exec(await readFile(new URL('../supabase/migrations/20261025230000_funnel_custom_period.sql',import.meta.url),'utf8'));
await db.exec('SET ROLE anon');await assert.rejects(()=>db.query("select * from get_page_funnel_window('quiz')"),/permission denied/);
await db.exec('RESET ROLE;SET ROLE authenticated');await assert.rejects(()=>db.query("select * from get_page_funnel_window('quiz')"),/restrito/);
await assert.rejects(()=>db.query("select * from get_quiz_answer_metrics_window()"),/restrito/);
await assert.rejects(()=>db.query("select get_page_funnel_sales_window('combo','rand')"),/authorized/);
await db.exec("SELECT set_config('test.admin','true',false)");
const period="'2026-10-01T03:00:00Z','2026-10-03T03:00:00Z'";
const events=(await db.query(`select * from get_page_funnel_window('quiz',${period})`)).rows;
assert.equal(Number(events[0].count),2);
const answers=(await db.query(`select * from get_quiz_answer_metrics_window(${period})`)).rows;assert.equal(answers.length,2);assert(answers.every(x=>Number(x.count)===1));
const sales=(await db.query("select get_page_funnel_sales_window('combo','rand','2026-10-01T03:00:00Z',150,null,'2026-10-03T03:00:00Z') as n")).rows;assert.equal(Number(sales[0].n),1);
await db.exec('RESET ROLE');assert.equal(Number((await db.query('select count(*) as n from page_funnel_events')).rows[0].n),5);
console.log('Custom funnel periods: bounds, session deduplication, quiz answers, approved sales, permissions and history preservation passed');await db.close();
