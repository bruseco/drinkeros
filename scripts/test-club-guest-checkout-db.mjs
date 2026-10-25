import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
await db.exec("CREATE TABLE purchases(id integer PRIMARY KEY,user_was_created boolean,metadata jsonb);");
await db.exec(await readFile(new URL('../supabase/migrations/20261025130000_club_guest_checkout.sql',import.meta.url),'utf8'));
for(const role of ['anon','authenticated']){
 await db.exec(`SET ROLE ${role}`);
 await assert.rejects(()=>db.query('SELECT * FROM club_guest_checkouts'),/permission denied/);
 await assert.rejects(()=>db.query('SELECT * FROM claim_club_guest_checkout($1,$2,$3,$4)',['a'.repeat(64),'buyer@example.com','card',97]),/permission denied/);
 await db.exec('RESET ROLE');
}
await db.exec('SET ROLE service_role');
const claim=async(hash,email='buyer@example.com',method='card',amount=97)=>(await db.query('SELECT * FROM claim_club_guest_checkout($1,$2,$3,$4)',[hash,email,method,amount])).rows[0];
const first=await claim('a'.repeat(64));assert.equal(first.claimed,true);
const replay=await claim('a'.repeat(64));assert.equal(replay.claimed,false);assert.equal(replay.id,first.id);
await assert.rejects(()=>claim('b'.repeat(64)),/tentativa em andamento/);
await assert.rejects(()=>claim('bad','other@example.com'),/inválidos/);
await assert.rejects(()=>claim('b'.repeat(64),'other@example.com','card',1),/check constraint/);
await db.query("UPDATE club_guest_checkouts SET status='failed' WHERE id=$1",[first.id]);
assert.equal((await claim('b'.repeat(64))).claimed,true);
const once=()=>db.query('UPDATE club_guest_checkouts SET activation_claimed_at=clock_timestamp() WHERE id=$1 AND activation_claimed_at IS NULL RETURNING id',[first.id]);
assert.equal((await once()).rows.length,1);assert.equal((await once()).rows.length,0);
await db.exec('RESET ROLE');
await db.exec(`INSERT INTO purchases VALUES(1,true,'{"guest_checkout_id":"guest-1","mp_preapproval_id":"pre-1"}');UPDATE purchases SET user_was_created=false,metadata='{"guest_checkout_id":"guest-1"}' WHERE id=1;`);
const preserved=(await db.query('SELECT * FROM purchases WHERE id=1')).rows[0];assert.equal(preserved.user_was_created,true);assert.equal(preserved.metadata.mp_preapproval_id,'pre-1');
console.log('Guest checkout: private sessions, idempotent claim, concurrent-email guard, allowed amounts and single activation passed');
await db.close();
