import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import {setStorageContext,enqueueMutation,loadQueuedMutations,flushMutationQueue,RetryableSyncError} from '../app/lib/offline-store.ts';
import type {KitchenMutation} from '../app/lib/mutations.ts';
test('offline queues stay isolated across accounts and preserve concurrently queued writes',async()=>{
  Object.assign(globalThis,{indexedDB});
  const mutation=(id:string)=>({id,dataEpoch:'fixture-epoch',type:'inventory.consume',payload:{id:'fixture-inventory'}} as KitchenMutation);
  setStorageContext('fixture-owner:household');await enqueueMutation(mutation('first'));
  setStorageContext('fixture-other:household');assert.deepEqual(await loadQueuedMutations(),[]);await enqueueMutation(mutation('other'));
  setStorageContext('fixture-owner:household');const result=await flushMutationQueue(async()=>{await enqueueMutation(mutation('concurrent'));});assert.equal(result.syncedCount,1);assert.deepEqual((await loadQueuedMutations()).map(v=>v.id),['concurrent']);
  assert.deepEqual(result.remaining.map(v=>v.id),['concurrent']);
  await flushMutationQueue(async()=>{throw new RetryableSyncError();});assert.deepEqual((await loadQueuedMutations()).map(v=>v.id),['concurrent']);
  setStorageContext('fixture-other:household');assert.deepEqual((await loadQueuedMutations()).map(v=>v.id),['other']);
});
