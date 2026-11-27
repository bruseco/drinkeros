// @vitest-environment node
import {Blob as NodeBlob} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const user='00000000-0000-0000-0000-000000000010';
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT '${user}'::uuid$$;
 CREATE TABLE profiles(user_id uuid,birth_date date);
 CREATE TABLE clube_public_offers(token_hash text PRIMARY KEY,user_id uuid,revealed_at timestamptz,expires_at timestamptz);
 CREATE TABLE quiz_offer_sessions(id uuid,token_hash text,path text,recommended text,arrived_at timestamptz,expires_at timestamptz,attribution jsonb);
 CREATE TABLE quiz_offer_prices(product text,product_type text,slug text,full_price numeric,quiz_price numeric,active boolean);
 INSERT INTO clube_public_offers VALUES('existing','${user}',now()-interval '1 hour',now()-interval '45 minutes');
 INSERT INTO quiz_offer_sessions VALUES('${user}','quiz','casa','xperience',now()-interval '1 hour',now()-interval '40 minutes','{}');
 INSERT INTO quiz_offer_prices VALUES('xperience','course','drinkeros-xperience',497,197,true),('clube','club','clube-anual',97,87,true);`);
 await db.exec(readFileSync('supabase/migrations/20261126120000_black80_campaign.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261127140000_black80_exclude_rand_course.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close()});
it('ships disabled, retaining regular expired annual and quiz prices',async()=>{
 expect((await db.query<any>('select * from public_black80_campaign()')).rows[0].enabled).toBe(false);
 expect((await db.query<any>('select * from clube_public_checkout_quote($1)',[user])).rows[0].price).toBe('197');
 expect((await db.query<any>("select * from quiz_quote('quiz','xperience')")).rows[0].price).toBe('497');
});
it('applies promotional quotes without resetting quiz deadlines or altering exclusions',async()=>{
 // Date boundaries are covered by black80.test.ts; make activation deterministic here.
 await db.exec(`UPDATE black80_campaign SET enabled=true;CREATE OR REPLACE FUNCTION public.black80_active() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$SELECT enabled FROM black80_campaign WHERE id$$;`);
 const before=(await db.query<any>("select expires_at from quiz_offer_sessions")).rows[0].expires_at;
 expect((await db.query<any>("select * from quiz_quote('quiz','xperience')")).rows[0]).toMatchObject({price:'99.40',active:false});
 expect((await db.query<any>("select * from quiz_quote('quiz','clube')")).rows[0].price).toBe('47');
 expect((await db.query<any>('select * from clube_public_checkout_quote($1)',[user])).rows[0].price).toBe('47');
 expect((await db.query<any>("select black80_price('course','classicos-destilados',697,697) regular,black80_price('course','classicos-destilados',697,197) vip")).rows[0]).toMatchObject({regular:'697',vip:'197'});
 expect((await db.query<any>("select black80_price('combo','rand',197,197) p,black80_price('club','clube-mensal-b',7,7) m")).rows[0]).toMatchObject({p:'197',m:'7'});
 expect((await db.query<any>("select expires_at from quiz_offer_sessions")).rows[0].expires_at).toEqual(before);
});
it('does not expose campaign controls to visitors and restores previous prices when disabled',async()=>{
 await db.exec('SET ROLE anon');
 await expect(db.exec('UPDATE black80_campaign SET enabled=true')).rejects.toThrow('permission denied');
 expect((await db.query<any>('select * from public_black80_campaign()')).rows[0].enabled).toBe(true);
 await db.exec('RESET ROLE;UPDATE black80_campaign SET enabled=false');
 expect((await db.query<any>('select * from clube_public_checkout_quote($1)',[user])).rows[0].price).toBe('197');
});
