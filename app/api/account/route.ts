import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {drizzle} from 'drizzle-orm/node-postgres';
import {currentAccount,accountContext,accountRepository} from '../../lib/auth/account';
import {createHouseholdSession,guestProof} from '../../lib/auth/session';
import {AccountAccessError,type Guest} from '../../lib/server/account-repository';
import {derivePasscode} from '../../lib/auth/crypto';
import {seedHousehold} from '../../lib/server/seed';
import {consumeRateLimit,invalidateSnapshot} from '../../lib/server/redis';
import {readJsonBody,requireSameOrigin,requestErrorResponse,clientAddress} from '../../lib/server/request';
import {readSecret} from '../../../db';
import * as schema from '../../../db/schema';
import {applyMutation} from '../../lib/server/repository';
import {validateKitchenMutation} from '../../lib/mutations';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const dynamic='force-dynamic';
export async function GET(){const account=await currentAccount(),repository=accountRepository();return Response.json({signedIn:Boolean(account),storageContext:account?accountContext(account.sub):'guest',households:account?await repository.list(account.sub):[],selected:account?await repository.selected(account.sub):null,guestClaimAvailable:account?!(await repository.claimStatus(account.sub)).used:false},{headers:{'cache-control':'no-store'}});}
export async function POST(request:Request){
  try{
    requireSameOrigin(request);const rate=await consumeRateLimit('account',clientAddress(request),120,60);if(!rate.allowed)return Response.json({error:'操作太频繁，请稍后再试'},{status:429});
    const input=await readJsonBody<{action?:string;name?:string;householdId?:string;invite?:string;previewToken?:string;confirm?:boolean;mutations?:unknown[]}>(request),account=await currentAccount(),repository=accountRepository();
    if(input.action==='create'){
      const creation=await consumeRateLimit('account-create',clientAddress(request),20,3600);if(!creation.allowed)return Response.json({error:'创建次数过多，请稍后再试'},{status:429});
      const existing=account?await repository.selected(account.sub):await repository.guest(await guestProof());if(existing)return Response.json({ok:true});
      const id=crypto.randomUUID(),name=input.name?.trim()||`${account?'我的':'游客'}厨房-${randomBytes(5).toString('hex')}`;if([...name].length>40)throw new AccountAccessError('家庭名称最多40个字符',400);
      const hash=await derivePasscode(randomBytes(32).toString('base64url'));
      await repository.create(account?.sub??null,id,name,hash,(client,id)=>seedHousehold(drizzle(client,{schema}),id));if(!account)await createHouseholdSession(id);return Response.json({ok:true},{status:201});
    }
    if(!account)throw new AccountAccessError('请先登录统一账号',401);
    if(input.action==='guest-sync'){
      if(!Array.isArray(input.mutations)||input.mutations.length>20)throw new AccountAccessError('一次最多同步20项离线修改',400);
      const proof=await guestProof(),guest=await repository.preview(account.sub,proof);
      for(const raw of input.mutations)await applyMutation(guest.householdId,validateKitchenMutation(raw),proof);
      await invalidateSnapshot(guest.householdId);
      return Response.json({syncedCount:input.mutations.length});
    }
    if(input.action==='select'){if(typeof input.householdId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.householdId))throw new AccountAccessError('请选择家庭',400);await repository.select(account.sub,input.householdId);return Response.json({ok:true});}
    if(input.action==='invite'){const selected=await repository.selected(account.sub);if(!selected)throw new AccountAccessError('请先进入家庭空间');return Response.json(await repository.invite(account.sub,selected.householdId));}
    if(input.action==='join'){if(typeof input.invite!=='string')throw new AccountAccessError('请输入邀请口令',400);await repository.join(account.sub,input.invite.trim());return Response.json({ok:true});}
    const sign=(payload:string)=>createHmac('sha256',readSecret('FRIBENCH_CLIENT_SECRET')).update(JSON.stringify(['meal-guest',account.sub,payload])).digest('hex');
    if(input.action==='preview'){
      const guest=await repository.preview(account.sub,await guestProof()),payload=Buffer.from(JSON.stringify({...guest,expires:Date.now()+30*60000})).toString('base64url');return Response.json({previewToken:payload+'.'+sign(payload),name:guest.name,version:guest.version,consumesOpportunity:false});
    }
    if(input.action==='claim'){
      if(input.confirm!==true||typeof input.previewToken!=='string'||input.previewToken.length>3000)throw new AccountAccessError('请预览并明确确认认领',400);
      const[payload,signature,...extra]=input.previewToken.split('.');if(!payload||!signature||extra.length||!timingSafeEqual(Buffer.from(digest(sign(payload)),'hex'),Buffer.from(digest(signature),'hex')))throw new AccountAccessError('预览已失效，请重新预览');
      const preview=JSON.parse(Buffer.from(payload,'base64url').toString()) as Guest&{expires:number};if(preview.expires<=Date.now())throw new AccountAccessError('预览已过期');
      await repository.claim(account.sub,await guestProof(),{...preview,previewHash:digest(input.previewToken)});return Response.json({claimed:true});
    }
    throw new AccountAccessError('不支持此操作',400);
  }catch(error){const response=requestErrorResponse(error);if(response)return response;if(error instanceof AccountAccessError)return Response.json({error:error.message},{status:error.status});return Response.json({error:'暂时无法完成操作，请稍后重试'},{status:503});}
}
