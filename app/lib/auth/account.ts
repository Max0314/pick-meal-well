import 'server-only';
import {cookies} from 'next/headers';
import {getPgPool,readSecret} from '../../../db';
import {accountClient,storageContext} from './account-client';
import {AccountRepository} from '../server/account-repository';
let client:ReturnType<typeof accountClient>|undefined;
export async function currentAccount(){
  const jar=await cookies(),cookie=jar.get('__Host-fribench_pick_meal_well')?.value;if(!cookie)return null;
  client??=accountClient(readSecret('FRIBENCH_CLIENT_SECRET'));
  return client('__Host-fribench_pick_meal_well='+cookie);
}
export function accountRepository(){return new AccountRepository(getPgPool());}
export function accountContext(sub:string){return storageContext(readSecret('FRIBENCH_CLIENT_SECRET'),sub);}
