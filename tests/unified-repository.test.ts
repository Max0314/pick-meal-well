import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {AccountRepository} from '../app/lib/server/account-repository.ts';
test('account claim requires guest proof, rejects overwrite and commits ownership and opportunity together',{skip:!process.env.TEST_DATABASE_URL},async()=>{
  const connectionString=process.env.TEST_DATABASE_URL!,schema='meal_account_'+randomBytes(8).toString('hex'),admin=new pg.Pool({connectionString,max:1});await admin.query(`CREATE SCHEMA "${schema}"`);
  const url=new URL(connectionString);url.searchParams.set('options','-c search_path='+schema);const pool=new pg.Pool({connectionString:url.toString(),max:4}),repository=new AccountRepository(pool);
  try{
    await pool.query(`CREATE TABLE households(id uuid PRIMARY KEY,name text NOT NULL,data_epoch uuid NOT NULL,version bigint NOT NULL DEFAULT 1);CREATE TABLE sessions(id uuid PRIMARY KEY,household_id uuid REFERENCES households(id),token_digest text NOT NULL,expires_at timestamptz NOT NULL);`);
    await pool.query((await readFile(new URL('../drizzle/0002_spooky_nocturne.sql',import.meta.url),'utf8')).replaceAll('"public".',`"${schema}".`));
    const household=crypto.randomUUID(),session=crypto.randomUUID(),epoch=crypto.randomUUID();
    await pool.query('INSERT INTO households VALUES($1,$2,$3,1,true)',[household,'游客测试厨房',epoch]);await pool.query("INSERT INTO sessions VALUES($1,$2,'guest-proof',now()+interval '1 day')",[session,household]);
    assert.equal(await repository.selected('fixture-owner'),null);
    const preview=await repository.preview('fixture-owner','guest-proof');assert.equal(preview.householdId,household);assert.equal((await repository.claimStatus('fixture-owner')).used,false);
    await pool.query("ALTER TABLE account_guest_claims ADD CONSTRAINT reject_fixture CHECK(account_id<>'fixture-owner')");
    await assert.rejects(repository.claim('fixture-owner','guest-proof',{...preview,previewHash:'fixture-preview'}));assert.equal(await repository.selected('fixture-owner'),null);assert.equal((await repository.claimStatus('fixture-owner')).used,false);
    await pool.query('ALTER TABLE account_guest_claims DROP CONSTRAINT reject_fixture');
    await repository.claim('fixture-owner','guest-proof',{...preview,previewHash:'fixture-preview'});assert.equal((await repository.selected('fixture-owner'))?.householdId,household);assert.equal((await repository.selected('fixture-owner'))?.role,'owner');assert.equal(await repository.guest('guest-proof'),null);
    await repository.claim('fixture-owner','guest-proof',{...preview,previewHash:'fixture-preview'});assert.equal((await repository.claimStatus('fixture-owner')).used,true);assert.equal(await repository.selected('fixture-other'),null);await assert.rejects(repository.preview('fixture-other','guest-proof'));
    const fresh=new AccountRepository(pool);assert.equal((await fresh.claimStatus('fixture-owner')).used,true);await assert.rejects(fresh.preview('fixture-owner','guest-proof'));
  }finally{await pool.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
