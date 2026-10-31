// @vitest-environment node
import {Blob as NodeBlob} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const user='00000000-0000-0000-0000-000000000010';
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`SET timezone='UTC';CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE purchases(metadata jsonb,user_was_created boolean);CREATE TABLE user_plans(user_id uuid PRIMARY KEY,plan text,source text,activated_at timestamptz,expires_at timestamptz);`);
 await db.exec(readFileSync('supabase/migrations/20261025130000_club_guest_checkout.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261031090000_club_b_monthly_card.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close()});
it('stores a single monthly card claim with a fixed R$7 price while annual claims stay annual',async()=>{
 const hash='c'.repeat(64);
 const first=(await db.query<any>('select * from claim_club_monthly_checkout($1,$2)',[hash,'monthly@example.com'])).rows[0];
 expect(first.claimed).toBe(true);
 expect((await db.query<any>('select * from claim_club_monthly_checkout($1,$2)',[hash,'monthly@example.com'])).rows[0].claimed).toBe(false);
 expect((await db.query<any>('select amount,method,billing_months from club_guest_checkouts where token_hash=$1',[hash])).rows[0]).toMatchObject({amount:'7',method:'card',billing_months:1});
 await db.query('select * from claim_club_guest_checkout($1,$2,$3,$4)',['d'.repeat(64),'annual@example.com','pix',87]);
 expect((await db.query<any>('select billing_months from club_guest_checkouts where email=$1',['annual@example.com'])).rows[0].billing_months).toBe(12);
 await expect(db.query("update club_guest_checkouts set method='pix' where token_hash=$1",[hash])).rejects.toThrow();
 await expect(db.query("update club_guest_checkouts set amount=1 where token_hash=$1",[hash])).rejects.toThrow();
});
it('extends monthly access idempotently without shortening annual or lifetime access',async()=>{
 await db.query('select grant_club_monthly_period($1,$2,$3)',[user,'2026-10-31','2026-11-30']);
 await db.query('select grant_club_monthly_period($1,$2,$3)',[user,'2026-10-31','2026-11-30']);
 expect((await db.query<any>('select expires_at from user_plans where user_id=$1',[user])).rows[0].expires_at).toEqual(new Date('2026-11-30Z'));
 await db.query("update user_plans set expires_at='2027-10-31' where user_id=$1",[user]);
 await db.query('select grant_club_monthly_period($1,$2,$3)',[user,'2026-10-31','2026-11-30']);
 expect((await db.query<any>('select expires_at from user_plans where user_id=$1',[user])).rows[0].expires_at).toEqual(new Date('2027-10-31Z'));
 await db.query("update user_plans set plan='vitalicio',expires_at=null where user_id=$1",[user]);
 await db.query('select grant_club_monthly_period($1,$2,$3)',[user,'2026-10-31','2026-11-30']);
 expect((await db.query<any>('select plan,expires_at from user_plans where user_id=$1',[user])).rows[0]).toMatchObject({plan:'vitalicio',expires_at:null});
});
it('does not allow clients to claim payment or grant access directly',async()=>{
 await db.exec('SET ROLE anon');
 await expect(db.query('select * from claim_club_monthly_checkout($1,$2)',['e'.repeat(64),'no@example.com'])).rejects.toThrow('permission denied');
 await db.exec('RESET ROLE;SET ROLE authenticated');
 await expect(db.query('select grant_club_monthly_period($1,$2,$3)',[user,'2026-10-31','2026-11-30'])).rejects.toThrow('permission denied');
 await db.exec('RESET ROLE');
});
