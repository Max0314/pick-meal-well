'use client';
import {useEffect,useState} from 'react';
import {accountAction,getAccount,type AccountView} from '../lib/client-api';
import {flushMutationQueue,getGuestStorageContext,setStorageContext} from '../lib/offline-store';
type Preview={previewToken:string;name:string;version:number};
export function UnifiedKitchenAccess({onEnter,inKitchen=false}:{onEnter?:()=>Promise<void>;inKitchen?:boolean}){
  const[account,setAccount]=useState<AccountView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState<Preview|null>(null),[invite,setInvite]=useState(''),[generated,setGenerated]=useState('');
  useEffect(()=>{let active=true;const refresh=()=>{void getAccount().then(value=>{if(active)setAccount(value);}).catch(()=>{if(active)setError('暂时无法确认账号，可继续游客体验，稍后重试。');});};refresh();window.addEventListener('fribench:account-change',refresh);return()=>{active=false;window.removeEventListener('fribench:account-change',refresh);};},[]);
  const enter=async()=>{if(onEnter)await onEnter();else{setStorageContext('pending');location.reload();}};
  const run=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setError('');try{await work();}catch(error){setError(error instanceof Error?error.message:'暂时无法完成操作');}finally{setBusy(false);}};
  return <section className="settings-card unified-access" aria-label="统一账号与家庭空间" data-account-controls>
    <h2>{account?.signedIn?'选择厨房':'先体验，按需登录'}</h2>
    {!account?.signedIn?<><p>无需注册即可使用推荐、菜谱、冰箱和采购。游客数据保留在当前浏览器对应的厨房。</p>{!inKitchen?<button className="primary-action" disabled={busy} onClick={()=>void run(async()=>{await accountAction({action:'create'});await enter();})}>开始游客体验</button>:null}<a className="unified-login-link" href="/_fribench/auth/login?return_to=%2F">登录 / 注册 Fribench 账号</a></>:<>
      <p>账号已连接。厨房是独立的数据空间；只会看到你创建或受邀加入的家庭。</p>
      {account.households.length?<><h3>已有厨房</h3>{account.households.map(household=><button key={household.householdId} disabled={busy||(inKitchen&&household.householdId===account.selected?.householdId)} onClick={()=>void run(async()=>{await accountAction({action:'select',householdId:household.householdId});await enter();})}>{household.name} · {household.role==='owner'?'所有者':'成员'}{household.householdId===account.selected?.householdId?'（当前）':''}</button>)}</>:<>
        <p>还没有厨房？创建自己的，或用家人发来的邀请加入。</p><button className="primary-action" disabled={busy} onClick={()=>void run(async()=>{await accountAction({action:'create'});await enter();})}>创建我的厨房</button>
        {account.guestClaimAvailable?<details><summary>已有游客厨房？导入以前的数据</summary><p>先预览，再决定是否导入。每个账号在本服务一次，不覆盖账号已有厨房。</p><button disabled={busy} onClick={()=>void run(async()=>{await flushMutationQueue(mutation=>accountAction({action:'guest-sync',mutations:[mutation]}),getGuestStorageContext());setPreview(await accountAction<Preview>({action:'preview'}));})}>同步并预览游客数据</button></details>:<p>本服务的游客认领机会已使用，正常存档不受影响。</p>}
      </>}
      {preview?<div role="group" aria-label="确认认领游客厨房"><p>认领“{preview.name}”（版本 {preview.version}）的已同步菜谱、冰箱、采购和历史。确认后归当前账号，每服务仅有一次机会；已有账号厨房不会被覆盖。</p><button disabled={busy} className="primary-action" onClick={()=>void run(async()=>{await accountAction({action:'claim',previewToken:preview.previewToken,confirm:true});await enter();})}>确认认领，仅此一次</button><button disabled={busy} onClick={()=>setPreview(null)}>取消，不扣次数</button></div>:null}
      <details><summary>加入家人的厨房</summary><p>需要家人提供有效邀请，不必再创建一份重复的厨房。</p><label>家人给我的邀请口令<input autoComplete="off" value={invite} maxLength={43} onChange={event=>setInvite(event.target.value)} /></label><button disabled={busy||!invite} onClick={()=>void run(async()=>{await accountAction({action:'join',invite});await enter();})}>通过邀请加入家庭</button></details>
      {account.selected?.role==='owner'?<><button disabled={busy} onClick={()=>void run(async()=>{const result=await accountAction<{token:string}>({action:'invite'});setGenerated(result.token);})}>生成家人邀请口令</button>{generated?<label>7天有效，最多加入10位家人，请仅发送给信任的人<input readOnly value={generated} onFocus={event=>event.currentTarget.select()} /></label>:null}</>:null}
      <div className="kitchen-account-actions"><a href="/_fribench/auth/manage?return_to=%2F" data-fribench-action="manage">个人资料与安全 →</a><button type="button" data-fribench-action="logout">退出此浏览器的账号</button></div>
      <p data-account-status role="status">昵称、头像、密码与设备授权在账号中心管理。退出不删除家庭数据。</p>
    </>}
    {error?<p className="form-error" role="alert">{error}</p>:null}
  </section>;
}
