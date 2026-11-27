// @vitest-environment node
import {Blob as NodeBlob} from 'node:buffer';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,it,expect} from 'vitest';
let db:PGlite;
const user='00000000-0000-0000-0000-000000000010';
beforeAll(async()=>{
 db=new PGlite({fsBundle:new NodeBlob([readFileSync('node_modules/@electric-sql/pglite/dist/pglite.data')]) as unknown as Blob});
 await db.exec(`SET timezone='UTC';CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;
 CREATE TABLE user_plans(user_id uuid PRIMARY KEY,plan text,source text,activated_at timestamptz,expires_at timestamptz);
 CREATE TABLE vip_payments(user_id uuid,metadata jsonb,period_end timestamptz,paid_at timestamptz);
 INSERT INTO vip_payments VALUES('${user}','{"mercadopago_payment_id":"historical","purchase_transaction_id":"historical-alias"}','2027-04-27','2026-04-27');`);
 await db.exec(readFileSync('supabase/migrations/20261127223000_club_annual_accumulation.sql','utf8'));
},30000);
afterAll(async()=>{await db?.close()});
async function grant(id:string,paid='2026-11-27'){return (await db.query<any>('select grant_club_annual_payment($1,$2,$3) AS expires',[user,id,paid])).rows[0].expires;}
it('adds one paid year after remaining access, replays once and keeps distinct purchases',async()=>{
 await db.query("insert into user_plans values($1,'vip','mercadopago','2026-04-27','2027-04-27')",[user]);
 expect(await grant('new')).toEqual(new Date('2028-04-26Z'));
 expect(await grant('new','2026-12-01')).toEqual(new Date('2028-04-26Z'));
 expect(await grant('second')).toEqual(new Date('2029-04-26Z'));
 expect((await db.query<any>('select expires_at from user_plans')).rows[0].expires_at).toEqual(new Date('2029-04-26Z'));
});
it('historical payment aliases are recognized without extending or shortening current access',async()=>{
 await grant('historical');await grant('historical-alias');
 expect((await db.query<any>('select expires_at from user_plans')).rows[0].expires_at).toEqual(new Date('2029-04-26Z'));
});
it('starts expired access on approval date and preserves lifetime plans',async()=>{
 await db.query("update user_plans set expires_at='2026-01-01' where user_id=$1",[user]);
 expect(await grant('expired')).toEqual(new Date('2027-11-27Z'));
 await db.exec("update user_plans set plan='vitalicio',expires_at=null");
 expect(await grant('lifetime')).toBeNull();
 expect((await db.query<any>('select plan,expires_at from user_plans')).rows[0]).toMatchObject({plan:'vitalicio',expires_at:null});
});
it('prevents client grants and payment reassignment',async()=>{
 await expect(db.query("select grant_club_annual_payment('00000000-0000-0000-0000-000000000011','new','2026-11-27')")).rejects.toThrow('another account');
 await db.exec('SET ROLE authenticated');
 await expect(grant('untrusted')).rejects.toThrow('permission denied');
 await db.exec('RESET ROLE');
});
