import type { KitchenSnapshot } from "./domain";
import type { KitchenMutation } from "./mutations";

const DB_NAME = "pick-meal-well";
let storageContext='guest';
try{storageContext=localStorage.getItem('pmw.storage-context')??'guest';}catch{}
let contextGeneration=0;
export function getContextGeneration(){return contextGeneration;}
export function setStorageContext(value:string){
  if(!/^[\w:-]{1,160}$/.test(value))throw new Error('无效的本地存储空间');
  if(value!==storageContext){storageContext=value;contextGeneration++;}
  try{localStorage.setItem('pmw.storage-context',value);if(value.startsWith('guest:'))localStorage.setItem('pmw.guest-context',value);}catch{}
}
export function getGuestStorageContext(){try{return localStorage.getItem('pmw.guest-context')??'guest';}catch{return'guest';}}
const DB_VERSION = 2;
const SNAPSHOT_STORE = "snapshot";
const MUTATION_STORE = "mutations";
const SNAPSHOT_KEY = "latest";

type MutationRecord = {
  sequence?: number;
  mutation: KitchenMutation;
};

export class RetryableSyncError extends Error {
  constructor(message = "网络暂时不可用") {
    super(message);
  }
}

export async function flushQueue(
  queue: KitchenMutation[],
  send: (mutation: KitchenMutation) => Promise<unknown>,
): Promise<{ remaining: KitchenMutation[]; syncedCount: number }> {
  for (let index = 0; index < queue.length; index += 1) {
    try {
      await send(queue[index]);
    } catch (error) {
      if (error instanceof RetryableSyncError) {
        return { remaining: queue.slice(index), syncedCount: index };
      }
      throw error;
    }
  }
  return { remaining: [], syncedCount: queue.length };
}

function openDatabase(context=storageContext): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(context==='guest'?DB_NAME:DB_NAME+':'+context, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) {
        database.createObjectStore(SNAPSHOT_STORE);
      }
      if (database.objectStoreNames.contains(MUTATION_STORE)) {
        database.deleteObjectStore(MUTATION_STORE);
      }
      database.createObjectStore(MUTATION_STORE, {
        keyPath: "sequence",
        autoIncrement: true,
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function complete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveCachedSnapshot(snapshot: KitchenSnapshot): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(SNAPSHOT_STORE, "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put(snapshot, SNAPSHOT_KEY);
  await complete(transaction);
  database.close();
}

export async function loadCachedSnapshot(): Promise<KitchenSnapshot | null> {
  const database = await openDatabase();
  if (!database) return null;
  const transaction = database.transaction(SNAPSHOT_STORE, "readonly");
  const request = transaction.objectStore(SNAPSHOT_STORE).get(SNAPSHOT_KEY);
  const value = await new Promise<KitchenSnapshot | null>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result as KitchenSnapshot | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

export async function enqueueMutation(mutation: KitchenMutation): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(MUTATION_STORE, "readwrite");
  transaction.objectStore(MUTATION_STORE).add({ mutation } satisfies MutationRecord);
  await complete(transaction);
  database.close();
}

export async function loadQueuedMutations(context=storageContext): Promise<KitchenMutation[]> {
  const database = await openDatabase(context);
  if (!database) return [];
  const transaction = database.transaction(MUTATION_STORE, "readonly");
  const request = transaction.objectStore(MUTATION_STORE).getAll();
  const value = await new Promise<KitchenMutation[]>((resolve, reject) => {
    request.onsuccess = () => resolve(
      (request.result as MutationRecord[])
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((record) => record.mutation),
    );
    request.onerror = () => reject(request.error);
  });
  database.close();
  return value;
}

export async function flushMutationQueue(
  send: (mutation: KitchenMutation) => Promise<unknown>,
  context=storageContext,
): Promise<{ remaining: KitchenMutation[]; syncedCount: number }> {
  const database=await openDatabase(context);if(!database)return{remaining:[],syncedCount:0};
  const read=database.transaction(MUTATION_STORE,'readonly'),query=read.objectStore(MUTATION_STORE).getAll();
  const records=await new Promise<MutationRecord[]>((resolve,reject)=>{query.onsuccess=()=>resolve((query.result as MutationRecord[]).sort((a,b)=>(a.sequence??0)-(b.sequence??0)));query.onerror=()=>reject(query.error);});
  const result=await flushQueue(records.map(value=>value.mutation),send).catch(error=>{database.close();throw error;});
  const write=database.transaction(MUTATION_STORE,'readwrite');for(const record of records.slice(0,result.syncedCount))if(record.sequence!==undefined)write.objectStore(MUTATION_STORE).delete(record.sequence);
  await complete(write);database.close();return {...result,remaining:await loadQueuedMutations(context)};
}

export async function clearLocalData(): Promise<void> {
  const database = await openDatabase();
  if (!database) return;
  const transaction = database.transaction(
    [SNAPSHOT_STORE, MUTATION_STORE],
    "readwrite",
  );
  transaction.objectStore(SNAPSHOT_STORE).clear();
  transaction.objectStore(MUTATION_STORE).clear();
  await complete(transaction);
  database.close();
}
