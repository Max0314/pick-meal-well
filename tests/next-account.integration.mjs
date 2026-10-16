// Explicit disposable infrastructure only. No production credentials or user accounts are used.
import {spawn} from 'node:child_process';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import pg from 'pg';
const databaseUrl=process.env.MEAL_HTTP_TEST_DATABASE_URL;
if(!databaseUrl||new URL(databaseUrl).pathname!=='/meal_verify_20261016')throw Error('Only the named disposable HTTP test database is allowed');
const pool=new pg.Pool({connectionString:databaseUrl,max:1});
for(const file of ['0000_broken_ikaris.sql','0001_parallel_human_cannonball.sql','0002_spooky_nocturne.sql'])await pool.query(await readFile(new URL('../drizzle/'+file,import.meta.url),'utf8'));
await pool.end();
const secret='fixture-only-client-secret-not-used-outside-disposable-tests';
const owner='__Host-fribench_pick_meal_well='+'o'.repeat(43),other='__Host-fribench_pick_meal_well='+'x'.repeat(43);
const identity=http.createServer((req,res)=>{if(req.headers.authorization!=='Basic '+Buffer.from('fribench-pick-meal-well:'+secret).toString('base64')||req.headers['x-fribench-app']!=='pick-meal-well'){res.writeHead(403);res.end();return;}const sub=req.headers.cookie===owner?'fixture-owner':req.headers.cookie===other?'fixture-other':null;res.setHeader('content-type','application/json');res.end(JSON.stringify(sub?{authenticated:true,sub,name:'测试家人'}:{authenticated:false}));});
await new Promise(resolve=>identity.listen(23195,'127.0.0.1',resolve));
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','23194'],{stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'production',DATABASE_URL:databaseUrl,REDIS_URL:'redis://127.0.0.1:55440',FRIBENCH_CLIENT_SECRET:secret,FRIBENCH_IDENTITY_ENDPOINT:'http://127.0.0.1:23195/internal/identity',SESSION_COOKIE_SECURE:'false',NEXT_TELEMETRY_DISABLED:'1'}});
let failure='';child.stderr.on('data',chunk=>{failure+=String(chunk);});child.stdout.on('data',()=>{});
const base='http://127.0.0.1:23194';
async function call(path,cookie='',body){const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{cookie,...(body===undefined?{}:{origin:base,'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,value:await response.json(),cookie:response.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};}
try{
  for(let attempt=0;;attempt++){try{if((await fetch(base+'/api/health/live')).ok)break;}catch{}if(attempt>80)throw Error('Local Next test service did not start');await new Promise(resolve=>setTimeout(resolve,200));}
  const created=await call('/api/account','',{action:'create'});assert.equal(created.status,201);const guest=created.cookie;
  let bootstrap=await call('/api/bootstrap',guest);assert.equal(bootstrap.value.authenticated,true);assert.equal(bootstrap.value.role,'guest');assert.equal(bootstrap.value.snapshot.dishes.length,20);const snapshot=bootstrap.value.snapshot;
  const inventoryId=snapshot.inventory[0].id;
  const command={id:crypto.randomUUID(),dataEpoch:snapshot.dataEpoch,type:'inventory.consume',payload:{id:inventoryId}};
  const sync=await call('/api/account',owner+'; '+guest,{action:'guest-sync',mutations:[command]});assert.equal(sync.status,200,JSON.stringify(sync.value));
  const before=await call('/api/bootstrap',owner+'; '+guest);assert.equal(before.value.authenticated,false);assert.equal(before.value.signedIn,true);
  const preview=await call('/api/account',owner+'; '+guest,{action:'preview'});assert.equal(preview.status,200,JSON.stringify(preview.value));
  assert.equal((await call('/api/account',owner+'; '+guest,{action:'claim',previewToken:preview.value.previewToken,confirm:false})).status,400);
  assert.equal((await call('/api/account',other+'; '+guest,{action:'claim',previewToken:preview.value.previewToken,confirm:true})).status,409);
  const claim=await call('/api/account',owner+'; '+guest,{action:'claim',previewToken:preview.value.previewToken,confirm:true});assert.equal(claim.status,200,JSON.stringify(claim.value));
  assert.equal((await call('/api/account',owner+'; '+guest,{action:'claim',previewToken:preview.value.previewToken,confirm:true})).status,200);
  bootstrap=await call('/api/bootstrap',owner);assert.equal(bootstrap.value.authenticated,true);assert.equal(bootstrap.value.role,'owner');assert(!JSON.stringify(bootstrap.value).includes('fixture-owner'));assert.equal(bootstrap.value.snapshot.inventory.some(value=>value.id===inventoryId),false);
  assert.equal((await call('/api/bootstrap',guest)).value.authenticated,false);assert.equal((await call('/api/bootstrap',other)).value.authenticated,false);
  assert.equal((await call('/api/mutations',guest,command)).status,401);
  const invite=await call('/api/account',owner,{action:'invite'});assert.equal(invite.status,200);assert.equal((await call('/api/account',other,{action:'join',invite:invite.value.token})).status,200);
  const member=await call('/api/bootstrap',other);assert.equal(member.value.role,'member');assert.equal(member.value.snapshot.household.name,bootstrap.value.snapshot.household.name);
  assert.equal((await call('/api/account',other,{action:'invite'})).status,403);
  assert.equal((await call('/api/household/reset',other,{confirmation:'RESET'})).status,403);
  const settings={id:crypto.randomUUID(),dataEpoch:member.value.snapshot.dataEpoch,type:'settings.update',payload:{...member.value.snapshot.household,name:'越权修改'}};
  assert.equal((await call('/api/mutations',other,settings)).status,403);
  console.log('HTTP integration passed: public guest, trusted accounts, guest sync/claim, second-device restore, invitation and owner permissions');
  if(process.env.KEEP_MEAL_HTTP_PREVIEW==='1'){console.log('Disposable browser preview remains on 23194; stop this process after UI checks.');await new Promise(resolve=>process.on('SIGINT',resolve));}
}catch(error){console.error('Disposable integration failed:',error.message);if(failure)console.error('Captured server diagnostic:',failure.replace(/postgres(ql)?:\/\/[^\s]+/g,'[database redacted]'));process.exitCode=1;}
finally{child.kill();await new Promise(resolve=>identity.close(resolve));}
