import {createHmac} from 'node:crypto';
export type AccountIdentity={sub:string;name:string};
export function storageContext(secret:string,sub:string){return createHmac('sha256',secret).update(['local-cache',sub].join('\0')).digest('base64url');}
export function accountClient(secret:string,fetcher:typeof fetch=fetch){
  const cache=new Map<string,{expires:number;pending:Promise<AccountIdentity|null>}>();
  return async(header:string|undefined):Promise<AccountIdentity|null>=>{
    const cookie=header?.split(';').map(value=>value.trim()).find(value=>value.startsWith('__Host-fribench_pick_meal_well='));
    if(!cookie||!/^__Host-fribench_pick_meal_well=[\w-]{43}$/.test(cookie))return null;
    if(!secret)throw Error('统一账号验证暂时不可用');
    const old=cache.get(cookie);if(old&&old.expires>Date.now())return old.pending;
    const entry={expires:Date.now()+5000,pending:(async()=>{
      const response=await fetcher(process.env.FRIBENCH_IDENTITY_ENDPOINT??'http://fribench-services-api-1:8080/internal/identity',{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{host:'meal.fribench.cn','x-fribench-app':'pick-meal-well',authorization:'Basic '+Buffer.from('fribench-pick-meal-well:'+secret).toString('base64'),cookie}});
      if(!response.ok)throw Error('统一账号验证暂时不可用');const value=await response.json() as {authenticated:boolean;sub?:string;name?:string};
      if(!value.authenticated)return null;if(typeof value.sub!=='string'||!value.sub)throw Error('统一账号响应无效');return{sub:value.sub,name:value.name??'家人'};
    })()};
    if(cache.size>=256)cache.clear();cache.set(cookie,entry);try{return await entry.pending;}catch(error){cache.delete(cookie);throw error;}
  };
}
