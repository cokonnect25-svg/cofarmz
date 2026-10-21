// Isolated tests: no database, real HTTP calls, credentials, or message sends.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const {createHmac} = require('node:crypto');
const path = require('node:path');
const originalEnv = {...process.env};
global.fetch = async () => { throw new Error('Real HTTP disabled in tests'); };
function load(file, deps = {}) {
 const mod={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',code)(id=>id in deps?deps[id]:require(id),mod,mod.exports);
 return mod.exports;
}
const core=load('lib/whatsapp-core.ts');
function configure(){Object.assign(process.env,{
 WHATSAPP_ENABLED:'true',WHATSAPP_DRY_RUN:'false',WHATSAPP_ROLLOUT_USER_IDS:'user1',
 WHATSAPP_TEMPLATES_APPROVED:'true',WHATSAPP_GRAPH_VERSION:'v99.0',WHATSAPP_PHONE_NUMBER_ID:'123',
 WHATSAPP_ACCESS_TOKEN:'mock-only',WHATSAPP_APP_SECRET:'mock-secret',WHATSAPP_TEMPLATE_LANGUAGE:'en',
 WHATSAPP_TEMPLATE_PROFILE_COMPLETION:'profile',WHATSAPP_TEMPLATE_CROP_ADDITION:'crops',WHATSAPP_TEMPLATE_NEARBY_MATCHES:'matches'
});}
function database(){
 const state={rows:[],pref:{user_id:'user1',opted_in:true,phone:'919876543210',registered_phone:'+91 98765 43210',nearby_matches:true,profile_completion:true,crop_addition:true,latitude:12,longitude:77,has_crops:true},usage:0};
 const db=async(strings,...v)=>{
  const q=strings.join('?').replace(/\s+/g,' ').trim();
  if(q.includes('pg_try_advisory_lock'))return [{acquired:true}];
  if(q.includes('pg_advisory_unlock'))return [];
  if(q.startsWith('INSERT INTO whatsapp_outbox')){
   const [category,event_key,user_id]=v;
   if(state.pref.opted_in && state.pref[category] && !state.rows.some(r=>r.event_key===event_key && r.category===category && r.user_id===user_id))state.rows.push({id:state.rows.length+1,user_id,category,event_key,status:'pending',attempts:0});
   return [];
  }
  if(q.startsWith('SELECT id,user_id,category'))return state.rows.filter(r=>r.status==='pending');
  if(q.startsWith('SELECT p.*'))return [state.pref];
  if(q.startsWith('SELECT count(*)'))return [{user_count:state.usage,total_count:state.usage}];
  if(q.includes("error_code='worker_interrupted'"))return [];
  if(q.startsWith('UPDATE whatsapp_outbox o'))return [];
  if(q.startsWith('UPDATE whatsapp_outbox')){
   const row=state.rows.find(r=>r.id===v.at(-1));if(!row)return [];
   if(q.includes("AND status='pending' RETURNING")){
    if(row.status!=='pending')return [];row.status='sending';return [{id:row.id}];
   }
   if(q.includes("SET status='cancelled'"))row.status='cancelled';
   else if(q.includes("SET status='pending'"))row.status='pending';
   else if(q.includes("SET status='sending'")){row.status='sending';row.attempts++;}
   else if(q.includes("SET status='accepted'")){row.status='accepted';row.message_id=v[0];state.usage++;}
   else if(q.includes('SET status=CASE'))row.status=row.attempts>=3?'failed':'pending';
   else row.status=v[0];
   return [];
  }
  throw new Error('Unexpected query: '+q);
 };
 db.reserve=async()=>{db.release=()=>{};return db;};db.begin=async fn=>fn(db);
 return {db,state};
}
function service(database,send){return load('lib/whatsapp.ts',{
 '@/app/api/utils/sql':{__esModule:true,default:database.db},
 '@/lib/profile-reminder-needs':load('lib/profile-reminder-needs.ts'),
 '@/lib/whatsapp-core':{...core,sendTemplate:send}
});}
(async()=>{
 configure();
 assert.equal(core.normalizeWhatsAppPhone('98765 43210'),'919876543210');
 assert.equal(core.normalizeWhatsAppPhone('+44 7700 900123'),'447700900123');
 assert.equal(core.normalizeWhatsAppPhone('abc9876543210'),null);
 const raw='{"object":"whatsapp_business_account"}';
 const signature='sha256='+createHmac('sha256','mock-secret').update(raw).digest('hex');
 assert(core.validSignature(raw,signature,'mock-secret'));
 assert(!core.validSignature(raw+' ',signature,'mock-secret'));
 assert(!core.validSignature(raw,'sha256=00','mock-secret'));
 let requests=0;
 const accepted=await core.sendTemplate('919876543210','nearby_matches',async(url,options)=>{
  requests++;assert.match(url,/graph.facebook.com\/v99.0\/123\/messages$/);
  const body=JSON.parse(options.body);assert.equal(body.type,'template');assert.equal(body.template.name,'matches');
  assert.equal(body.to,'919876543210');assert.equal(options.headers.Authorization,'Bearer mock-only');
  return new Response(JSON.stringify({messages:[{id:'wamid.mock'}]}),{status:200});
 });
 assert.deepEqual(accepted,{kind:'accepted',id:'wamid.mock'});
 const limited=await core.sendTemplate('919876543210','nearby_matches',async()=>new Response(JSON.stringify({error:{code:130429}}),{status:429,headers:{'retry-after':'600'}}));
 assert.equal(limited.kind,'retry');assert.equal(limited.delay,600);
 assert.equal((await core.sendTemplate('919876543210','nearby_matches',async()=>new Response('{}',{status:401}))).kind,'failed');
 assert.equal((await core.sendTemplate('919876543210','nearby_matches',async()=>new Response('{}',{status:503}))).kind,'unknown');
 assert.equal((await core.sendTemplate('919876543210','nearby_matches',async()=>{throw new Error('timeout');})).kind,'unknown');
 delete process.env.WHATSAPP_ACCESS_TOKEN;
 assert.equal((await core.sendTemplate('919876543210','nearby_matches',async()=>{throw new Error('must not send');})).kind,'configuration');configure();
 console.log('PASS phone normalization, signatures, template payload, API errors, throttling, timeout quarantine');
 let sends=0;
 const d=database();const svc=service(d,async()=>{sends++;return accepted;});
 await Promise.all([svc.enqueueWhatsApp('user1','nearby_matches','event1'),svc.enqueueWhatsApp('user1','nearby_matches','event1')]);
 assert.equal(d.state.rows.length,1);
 await svc.processWhatsAppQueue();await svc.processWhatsAppQueue();assert.equal(sends,1);assert.equal(d.state.rows[0].status,'accepted');
 assert.equal(svc.matchEventKey(['b','a'],'Rice'),svc.matchEventKey(['a','b','a'],' rice '));
 await svc.enqueueWhatsApp('user1','nearby_matches','event2');d.state.pref.opted_in=false;
 await svc.processWhatsAppQueue();assert.equal(sends,1);assert.equal(d.state.rows[1].status,'cancelled');
 await svc.enqueueWhatsApp('user1','nearby_matches','event3');assert.equal(d.state.rows.length,2);
 console.log('PASS duplicate events, repeat worker runs, deterministic match keys, opt-out before dispatch/enqueue');
 for(const scenario of ['dry-run','allowlist','phone-change','frequency','disabled','category-off','completed-profile','retry','unknown']){
  configure();const data=database();let calls=0;
  const api=service(data,async()=>{calls++;return scenario==='retry'?{kind:'retry',code:'130429',delay:300}:scenario==='unknown'?{kind:'unknown'}:accepted;});
  await api.enqueueWhatsApp('user1',scenario==='completed-profile'?'profile_completion':'nearby_matches','one');
  if(scenario==='dry-run')process.env.WHATSAPP_DRY_RUN='true';
  if(scenario==='allowlist')process.env.WHATSAPP_ROLLOUT_USER_IDS='';
  if(scenario==='phone-change')data.state.pref.registered_phone='+919999999999';
  if(scenario==='frequency')data.state.usage=1;
  if(scenario==='disabled')process.env.WHATSAPP_ENABLED='false';
  if(scenario==='category-off')data.state.pref.nearby_matches=false;
  await api.processWhatsAppQueue();
  assert.equal(calls,['retry','unknown'].includes(scenario)?1:0,scenario);
  if(scenario==='retry'){assert.equal(data.state.rows[0].status,'pending');await api.processWhatsAppQueue();await api.processWhatsAppQueue();assert.equal(data.state.rows[0].status,'failed');}
  if(scenario==='unknown'){await api.processWhatsAppQueue();assert.equal(calls,1);}
 }
 console.log('PASS dry-run, allowlist, changed number, frequency, disabled channel, category opt-out, completed profile, bounded retries');
 configure();let updates=0;
 const webhook=load('app/api/whatsapp/webhook/route.ts',{'next/server':{NextResponse:{json:body=>Response.json(body)}},'@/lib/whatsapp-core':core,'@/app/api/utils/sql':{__esModule:true,default:Object.assign(async()=>{updates++;return [];},{begin:async fn=>fn(async()=>{updates++;return [];})})}});
 const payload=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'123'},messages:[{from:'919876543210',text:{body:'STOP'}}]}}]}]});
 const signed='sha256='+createHmac('sha256','mock-secret').update(payload).digest('hex');
 assert.equal((await webhook.POST(new Request('https://test/webhook',{method:'POST',body:payload}))).status,403);assert.equal(updates,0);
 assert.equal((await webhook.POST(new Request('https://test/webhook',{method:'POST',body:payload,headers:{'x-hub-signature-256':signed}}))).status,200);assert.equal(updates,1);
 console.log('PASS webhook rejects unsigned requests and processes signed STOP');
 const deep=load('lib/deep-link.ts');
 for(const type of core.categories){assert(deep.getInAppPathFromSharedUrl(deep.buildOpenUrl('/whatsapp',{type})));}
 assert.equal(deep.getInAppPathFromSharedUrl('https://evil.example/open?path=/whatsapp'),null);
 console.log('PASS all three CTA links and external-host rejection');

 let pushCalls=0;let queryCalls=0;
 const failingDb=async()=>{throw new Error('simulated queue database failure');};
 const waFailure=service({db:failingDb},async()=>{throw new Error('must not send');});
 const cropTrigger=load('app/api/utils/crop-match-push.ts',{
  '@/lib/whatsapp':waFailure,
  '@/app/api/utils/push':{sendPushToUser:async()=>{pushCalls++;return {succeeded:1};}},
  '@/app/api/utils/sql':{__esModule:true,default:async()=>++queryCalls===1?[{id:'source',role:'farmer',latitude:12,longitude:77}]:[{id:'match',name:'Mock',role:'buyer',distance_km:1}]}
 });
 const oldError=console.error;console.error=()=>{};
 try{await cropTrigger.sendCropMatchPushes('source','rice');}finally{console.error=oldError;}
 assert.equal(pushCalls,2);
 console.log('PASS WhatsApp queue failure does not prevent either FCM match notification');
 let saved=0;
 class InputError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const prefs=load('app/api/whatsapp/preferences/route.ts',{
  'next/server':{NextResponse:{json:(body,init)=>Response.json(body,init)}},
  '@/lib/whatsapp-core':core,
  '@/lib/fpo-access':{FpoError:InputError,requireActor:async()=>({id:'authenticated-user'})},
  '@/app/api/utils/sql':{__esModule:true,default:{begin:async fn=>fn(async(strings,...values)=>{
   const q=strings.join('?');
   if(q.includes('SELECT phone')){assert.equal(values[0],'authenticated-user');return [{phone:'9876543210'}];}
   if(q.includes('INSERT INTO whatsapp_preferences')){assert.equal(values[0],'authenticated-user');saved++;return [];}
   return [];
  })}}
 });
 const preferenceBody={userId:'another-user',opted_in:true,profile_completion:true,crop_addition:true,nearby_matches:true};
 const request=body=>new Request('https://test/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await prefs.PUT(request(preferenceBody))).status,400);assert.equal(saved,0);
 assert.equal((await prefs.PUT(request({...preferenceBody,consent:true}))).status,200);assert.equal(saved,1);
 console.log('PASS explicit consent required and preference owner comes from authenticated session');
 console.log('All WhatsApp mock tests passed.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{process.env=originalEnv;});
