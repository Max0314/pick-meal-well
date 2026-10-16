import test from 'node:test';
import assert from 'node:assert/strict';
import {accountClient,storageContext} from '../app/lib/auth/account-client.ts';
test('only the exact application cookie reaches the protected identity endpoint, and concurrent lookups coalesce',async()=>{
  let calls=0;
  const client=accountClient('fixture-client-secret-long-enough-for-test',async(_url,init)=>{
    calls++;assert.equal(new Headers(init?.headers).get('cookie'),'__Host-fribench_pick_meal_well='+'a'.repeat(43));
    assert.equal(new Headers(init?.headers).get('x-fribench-app'),'pick-meal-well');
    return Response.json({authenticated:true,sub:'fixture-subject',name:'朋友'});
  });
  assert.equal(await client('pmw_session=not-an-account; arbitrary=private'),null);assert.equal(calls,0);
  const values=await Promise.all(Array.from({length:12},()=>client('__Host-fribench_pick_meal_well='+'a'.repeat(43)+'; private=do-not-forward')));
  assert.equal(calls,1);assert.equal(values[0]?.sub,'fixture-subject');
  assert.notEqual(storageContext('fixture-client-secret-long-enough-for-test','fixture-subject'),'fixture-subject');
  assert.notEqual(storageContext('fixture-client-secret-long-enough-for-test','fixture-subject'),storageContext('fixture-client-secret-long-enough-for-test','other-subject'));
});
