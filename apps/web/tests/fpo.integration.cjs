// Real PostgreSQL integration tests. Authentication boundary and geocoder/FCM are fixtures.
// Refuses non-loopback databases; drops only this test's dedicated schema.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const url = process.env.FPO_TEST_DATABASE_URL || 'postgres://postgres@127.0.0.1:55439/postgres';
if (!['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Use an isolated local test DB');
const db = require('postgres')(url,{max:8,onnotice:()=>{},connection:{search_path:'fpo_integration'}});
const nativeLoad = Module._load;
let pushes = [];
Module._load = function(name,parent,isMain) {
  if(name==='@/app/api/utils/sql') return {__esModule:true,default:db};
  if(name==='@/lib/auth') return {auth:{api:{getSession:async ({headers})=>{
    const token=headers.get('cookie')?.match(/fixture_session=([^;]+)/)?.[1];
    if(!token)return null;
    const [s]=await db`SELECT "userId" FROM session WHERE token=${token} AND "expiresAt">now()`;
    return s?{user:{id:s.userId}}:null;
  }}}};
  if(name==='@/app/api/utils/push') return {
    sendPushToUser:async(id,payload)=>{pushes.push({id,payload});return {attempted:1,succeeded:1,failed:0};},
    sendPushToAllUsers:async()=>{throw new Error('Group message attempted global push');}
  };
  if(name.startsWith('@/')) name=path.join(root,name.slice(2));
  return nativeLoad.call(this,name,parent,isMain);
};
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const route = p=>require(path.join(root,'app/api',p,'route.ts'));
function request(actor,body,method='POST',url='/api/test') {
  return new Request('http://localhost'+url,{method,headers:{...(actor?{cookie:`fixture_session=${actor}`} : {}),'content-type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body||{})})});
}
let passed=0;
async function test(name,fn) {await fn();passed++;console.log('PASS',name);}
async function user(id,role='farmer',confirmed=true,location=null,lat=null,lng=null) {
  await db`INSERT INTO "user"(id,name,email,role,role_id,role_confirmed,location,latitude,longitude) VALUES(${id},${id},${id+'@test.invalid'},${role},${role==='farmer'?1:role==='superadmin'?5:2},${confirmed},${location},${lat},${lng})`;
  await db`INSERT INTO session(token,"userId","expiresAt") VALUES(${id},${id},now()+interval '1 hour')`;
}
(async()=>{
  await db.unsafe('CREATE SCHEMA IF NOT EXISTS fpo_integration');
  await db.unsafe(`CREATE TABLE roles(id int primary key,name text,display_name text,permissions jsonb);
    INSERT INTO roles VALUES(1,'farmer','Farmer','{}'),(2,'buyer','Buyer','{}'),(3,'supplier','Supplier','{}'),(4,'fpo','FPO','{}'),(5,'superadmin','Super Admin','{}');
    CREATE TABLE "user"(id text primary key,name text,email text,role text,role_id int,role_confirmed boolean,
    location text,latitude double precision,longitude double precision,image text,phone text,gender text,age int,bio text,
    phone_verified boolean default false,phone_verified_at timestamptz,supplier_types text[],calling_enabled boolean default true,
    "updatedAt" timestamptz default now());
    CREATE TABLE session(token text primary key,"userId" text,"expiresAt" timestamptz);
    CREATE TABLE announcements(id uuid primary key default gen_random_uuid(),title text,body text,created_by text,
    created_at timestamptz default now(),expires_at timestamptz,scheduled_at timestamptz,repeat_interval_hours int,
    next_send_at timestamptz,last_sent_at timestamptz,send_count int default 0,is_active boolean default true);`);
  const migration=fs.readFileSync(path.join(root,'migrations/20260923_digital_fpos.sql'),'utf8');
  const reserved=await db.reserve();
  try { await reserved.unsafe(migration); await reserved.unsafe(migration); } finally {reserved.release();}
  for(const district of ['Madurai','Chennai']) await db`INSERT INTO fpo_districts(state,district,source) VALUES('Tamil Nadu',${district},'fixture')`;
  await user('admin','superadmin'); await user('new-m','buyer',false);await user('new-c','buyer',false);await user('invalid','buyer',false);
  const fpos=route('digital-fpos');const profiles=route('users/profile');
  const assignment=require('../lib/fpo-assignment.ts');
  let madurai,chennai;
  await test('Only Super Admin can create an FPO',async()=>{
    assert.equal((await fpos.POST(request(null,{state:'Tamil Nadu',district:'Madurai'}))).status,401);
    assert.equal((await fpos.POST(request('new-m',{state:'Tamil Nadu',district:'Madurai'}))).status,403);
    const r=await fpos.POST(request('admin',{state:'Tamil Nadu',district:'Madurai'}));assert.equal(r.status,201);madurai=await r.json();
    chennai=await (await fpos.POST(request('admin',{state:'Tamil Nadu',district:'Chennai'}))).json();
  });
  await test('Madurai registration atomically assigns correct FPO and group',async()=>{
    const r=await profiles.POST(request('new-m',{userId:'new-m',role:'farmer',state:'Tamil Nadu',district:'Madurai'}));assert.equal(r.status,200,await r.text());
    const [a]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='new-m'`;assert.equal(a.group_id,madurai.group_id);
  });
  await test('Chennai registration assigns Chennai',async()=>{
    assert.equal((await profiles.POST(request('new-c',{userId:'new-c',role:'farmer',state:'Tamil Nadu',district:'Chennai'}))).status,200);
    const [a]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='new-c'`;assert.equal(a.group_id,chennai.group_id);
  });
  await test('Invalid State/District registration rejected without confirming role',async()=>{
    assert.equal((await profiles.POST(request('invalid',{userId:'invalid',role:'farmer',state:'Andhra Pradesh',district:'Madurai'}))).status,400);
    const [u]=await db`SELECT role_confirmed FROM "user" WHERE id='invalid'`;assert.equal(u.role_confirmed,false);
  });
  await test('Spoofed identity, assignment IDs and role escalation rejected',async()=>{
    assert.equal((await profiles.POST(request('invalid',{userId:'invalid',role:'superadmin'}))).status,400);
    assert.equal((await profiles.PUT(request('new-m',{userId:'new-c',state:'Tamil Nadu',district:'Chennai'},'PUT'))).status,403);
    assert.equal((await profiles.PUT(request('new-m',{userId:'new-m',group_id:chennai.group_id},'PUT'))).status,400);
    const fake=new Request('http://localhost/api/digital-fpos',{method:'POST',headers:{'content-type':'application/json','x-user-id':'admin'},body:JSON.stringify({state:'Tamil Nadu',district:'Chennai'})});
    assert.equal((await fpos.POST(fake)).status,401);
  });
  await test('Concurrent duplicate FPO creation never creates extra groups',async()=>{
    const responses=await Promise.all([1,2].map(()=>fpos.POST(request('admin',{state:'tamil nadu',district:'MADURAI'}))));
    assert(responses.every(r=>r.status===409));
    assert.equal(Number((await db`SELECT count(*) n FROM farmer_groups`)[0].n),2);
  });
  process.env.FPO_GEOCODER_URL='https://geocoder.test/';
  const nativeFetch=global.fetch;let urls=[];
  global.fetch=async url=>{urls.push(String(url));const address={country_code:'in',state:'Tamil Nadu',state_district:'Madurai district'};return Response.json(String(url).includes('/reverse')?{address}:[{address}]);};
  await user('coords','farmer',true,'Old address',9.9,78.1);await user('address','farmer',true,'Madurai Tamil Nadu');await user('missing');
  await test('Legacy coordinates take precedence over address',async()=>{const a=await assignment.processFarmer('coords');assert.equal(a.assignment_source,'latitude_longitude');assert.equal(a.group_id,madurai.group_id);assert(urls.at(-1).includes('/reverse'));});
  await test('Legacy address resolves when coordinates absent',async()=>{const a=await assignment.processFarmer('address');assert.equal(a.assignment_source,'address');assert.equal(a.group_id,madurai.group_id);assert(urls.at(-1).includes('/search'));});
  await test('No usable location stays pending without guessing',async()=>{const a=await assignment.processFarmer('missing');assert.equal(a.assignment_status,'pending_location');assert.equal(a.group_id,null);});
  await test('Dry run does not create assignments',async()=>{await user('preview');await assignment.processFarmer('preview',true);assert.equal((await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='preview'`).length,0);});
  await test('Pending farmer gains membership after location update',async()=>{assert.equal((await profiles.PUT(request('missing',{userId:'missing',state:'Tamil Nadu',district:'Madurai'},'PUT'))).status,200);assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='missing'`)[0].group_id,madurai.group_id);});
  await test('Repeated processing creates no duplicate memberships/FPOs/groups',async()=>{
    await assignment.processFarmer('coords');await assignment.processFarmer('coords');
    assert.equal(Number((await db`SELECT count(*) n FROM farmer_fpo_assignments WHERE farmer_id='coords'`)[0].n),1);
    assert.equal(Number((await db`SELECT count(*) n FROM digital_fpos`)[0].n),2);
    assert.equal(Number((await db`SELECT count(*) n FROM farmer_groups`)[0].n),2);
  });
  global.fetch=nativeFetch;
  const announcements=route('admin/announcements');
  await test('Group push is delivered only to active members and never contains private text',async()=>{
    const r=await announcements.POST(request('admin',{title:'Madurai private',body:'Private details',groupId:madurai.group_id}));assert.equal(r.status,201,await r.text());
    assert(pushes.some(p=>p.id==='new-m'));assert(!pushes.some(p=>p.id==='new-c'));assert(pushes.every(p=>!p.payload.body.includes('Private')));
    assert.equal((await announcements.POST(request('new-m',{title:'Spoof',body:'Spoof',groupId:chennai.group_id}))).status,403);
  });
  await announcements.POST(request('admin',{title:'Chennai private',body:'Chennai details',groupId:chennai.group_id}));
  const messages=route('digital-fpos/messages');
  await test('Feed and unread counts exclude another group',async()=>{
    const r=await (await messages.GET(request('new-m',null,'GET','/api/digital-fpos/messages?groupId='+chennai.group_id))).json();
    assert.equal(r.unread,1);assert.equal(r.messages.length,1);assert.equal(r.messages[0].title,'Madurai private');
    const general=await (await announcements.GET(request('new-m',null,'GET'))).json();assert(general.every(a=>a.group_id===madurai.group_id));
    await messages.POST(request('new-m',{}));assert.equal((await (await messages.GET(request('new-m',null,'GET'))).json()).unread,0);
  });
  await test('Other FPO profile is discoverable and viewing it never joins group',async()=>{
    const r=await route('digital-fpos/[id]').GET(request('new-m',null,'GET'),{params:Promise.resolve({id:chennai.id})});assert.equal(r.status,200);
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='new-m'`)[0].group_id,madurai.group_id);
  });
  await test('District change revokes old messages and atomically replaces membership',async()=>{
    assert.equal((await profiles.PUT(request('new-m',{userId:'new-m',state:'Tamil Nadu',district:'Chennai'},'PUT'))).status,200);
    const r=await (await messages.GET(request('new-m',null,'GET'))).json();assert.equal(r.messages.length,1);assert.equal(r.messages[0].title,'Chennai private');
    assert.equal(Number((await db`SELECT count(*) n FROM farmer_fpo_assignments WHERE farmer_id='new-m'`)[0].n),1);
  });
  await test('Deactivation immediately revokes group access',async()=>{
    assert.equal((await fpos.PATCH(request('admin',{id:chennai.id,status:'inactive'},'PATCH'))).status,200);
    assert.equal((await (await messages.GET(request('new-c',null,'GET'))).json()).messages.length,0);
    assert.equal((await announcements.POST(request('admin',{title:'Inactive',body:'No',groupId:chennai.group_id}))).status,400);
  });
  await test('Missing configured FPO remains pending and no FPO is auto-created',async()=>{
    await db`INSERT INTO fpo_districts(state,district,source) VALUES('Tamil Nadu','Coimbatore','fixture')`;
    assert.equal((await profiles.PUT(request('missing',{userId:'missing',state:'Tamil Nadu',district:'Coimbatore'},'PUT'))).status,200);
    const [a]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='missing'`;assert.equal(a.assignment_status,'pending_fpo');assert.equal(a.group_id,null);
  });
  await test('Database rejects cross-district and duplicate memberships',async()=>{
    await assert.rejects(()=>db`UPDATE farmer_fpo_assignments SET group_id=${madurai.group_id},assignment_status='assigned' WHERE farmer_id='new-m'`);
    await assert.rejects(()=>db`INSERT INTO farmer_fpo_assignments SELECT * FROM farmer_fpo_assignments WHERE farmer_id='coords'`);
  });
  await test('Farmer cannot invoke admin assignment or processing',async()=>{
    const admin=route('admin/fpo');
    assert.equal((await admin.POST(request('new-m',{action:'assign',farmer_id:'new-m',state:'Tamil Nadu',district:'Madurai'}))).status,403);
    assert.equal((await admin.POST(request('new-m',{action:'process'}))).status,403);
  });
  await test('Invalid coordinates are rejected without changing membership',async()=>{
    assert.equal((await profiles.PUT(request('coords',{userId:'coords',latitude:95,longitude:78},'PUT'))).status,400);
    assert.equal((await profiles.PUT(request('coords',{userId:'coords',latitude:true,longitude:78},'PUT'))).status,400);
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='coords'`)[0].group_id,madurai.group_id);
  });
  await test('Inactive FPO can reactivate existing members',async()=>{
    await fpos.PATCH(request('admin',{id:chennai.id,status:'active'},'PATCH'));
    assert.equal((await (await messages.GET(request('new-c',null,'GET'))).json()).messages.length,1);
  });
  await test('Failed reassignment transaction rolls back profile and membership together',async()=>{
    const before=(await db`SELECT district_id FROM "user" WHERE id='coords'`)[0].district_id;
    await assert.rejects(()=>db.begin(async tx=>{
      await tx`UPDATE "user" SET district_id=${chennai.district_id} WHERE id='coords'`;
      await assignment.assignFarmer(tx,'coords',madurai.district_id,'profile_update');
    }));
    assert.equal((await db`SELECT district_id FROM "user" WHERE id='coords'`)[0].district_id,before);
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='coords'`)[0].group_id,madurai.group_id);
  });
  await test('Scheduled group delivery also uses current membership',async()=>{
    process.env.ANNOUNCEMENT_SCHEDULER_SECRET='fixture-secret';
    await db`UPDATE announcements SET next_send_at=now()-interval '1 minute',is_active=true,send_count=1 WHERE group_id=${madurai.group_id}`;
    pushes=[];
    const req=new Request('http://localhost/api/admin/announcements/process',{method:'POST',headers:{'x-scheduler-secret':'fixture-secret'}});
    const res=await route('admin/announcements/process').POST(req);assert.equal(res.status,200);
    assert(pushes.some(p=>p.id==='coords'));assert(!pushes.some(p=>p.id==='new-m'));assert(!pushes.some(p=>p.id==='new-c'));
  });
  await test('Unchanged location in ordinary profile edit preserves assignment without geocoding',async()=>{
    delete process.env.FPO_GEOCODER_URL;
    const res=await profiles.PUT(request('coords',{userId:'coords',name:'Updated farmer',location:'Old address',latitude:9.9,longitude:78.1},'PUT'));
    assert.equal(res.status,200);
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='coords'`)[0].group_id,madurai.group_id);
  });
  console.log(`${passed} integration tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.unsafe('DROP SCHEMA IF EXISTS fpo_integration CASCADE');await db.end();});
