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
  try { await reserved.unsafe(migration); await reserved.unsafe(migration);
    const reviewerMigration=fs.readFileSync(path.join(root,'migrations/20260923_fpo_admin_review.sql'),'utf8');
    await reserved.unsafe(reviewerMigration);await reserved.unsafe(reviewerMigration); } finally {reserved.release();}
  for(const district of ['Madurai','Chennai']) await db`INSERT INTO fpo_districts(state,district,source) VALUES('Tamil Nadu',${district},'fixture')`;
  const subdistrictConnection=await db.reserve();
  try {
    const migration=fs.readFileSync(path.join(root,'migrations/20260925_fpo_subdistricts.sql'),'utf8');
    await subdistrictConnection.unsafe(migration);await subdistrictConnection.unsafe(migration);
    const localities=fs.readFileSync(path.join(root,'migrations/20260925_fpo_localities.sql'),'utf8');
    await subdistrictConnection.unsafe(localities);await subdistrictConnection.unsafe(localities);
  } finally { subdistrictConnection.release(); }
  await user('admin','superadmin'); await user('new-m','buyer',false);await user('new-c','buyer',false);await user('invalid','buyer',false);
  const fpos=route('digital-fpos');const profiles=route('users/profile');
  const assignment=require('../lib/fpo-assignment.ts');
  let madurai,chennai;
  await test('Only administrative accounts can create an FPO',async()=>{
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
  await test('Legacy uses saved profile address, ignoring coordinates',async()=>{const a=await assignment.processFarmer('coords');assert.equal(a.assignment_source,'address');assert.equal(a.group_id,madurai.group_id);assert(urls.at(-1).includes('/search'));assert(urls.at(-1).includes('Old+address'));});
  await test('Saved district and state text resolves without a geocoder',async()=>{const a=await assignment.processFarmer('address');assert.equal(a.assignment_source,'address');assert.equal(a.group_id,madurai.group_id);});
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
  await test('Farmer discovery exposes public profiles without group or member details',async()=>{
    const data=await (await fpos.GET(request('coords',null,'GET'))).json();
    assert.equal(data.can_create,false);
    for(const fpo of data.fpos) {
      assert.deepEqual(Object.keys(fpo).sort(),['district','id','name','state','status']);
      const profile=await (await route('digital-fpos/[id]').GET(request('coords',null,'GET'),{params:Promise.resolve({id:fpo.id})})).json();
      assert.deepEqual(Object.keys(profile).sort(),['district','id','name','state','status']);
    }
    assert.equal((await fpos.POST(request('coords',{state:'Tamil Nadu',district:'Coimbatore'}))).status,403);
  });
  await user('reviewer','admin');
  await test('Admin can discover active and inactive FPOs without management capability',async()=>{
    await fpos.PATCH(request('admin',{id:chennai.id,status:'inactive'},'PATCH'));
    const d=await (await fpos.GET(request('reviewer',null,'GET'))).json();
    assert.equal(d.can_review,true);assert.equal(d.can_create,true);assert.equal(d.can_manage,false);assert(d.fpos.some(f=>f.id===chennai.id));assert.equal(d.fpos.find(f=>f.id===chennai.id).farmer_count,2);
    assert.equal((await route('digital-fpos/[id]').GET(request('reviewer',null,'GET'),{params:Promise.resolve({id:chennai.id})})).status,200);
  });
  await test('Admin can review any group members and messages; farmers cannot',async()=>{
    for(const group of [madurai,chennai]) {
      const req=request('reviewer',null,'GET','/api/admin/fpo/messages?group='+group.group_id);
      const r=await route('admin/fpo/messages').GET(req);assert.equal(r.status,200);
      const d=await r.json();assert(d.messages.length>0);assert.equal(d.group.id,group.group_id);
      const people=await route('admin/fpo').GET(request('reviewer',null,'GET','/api/admin/fpo?group='+group.group_id));
      assert.equal(people.status,200);assert((await people.json()).farmers.every(f=>f.group_id===group.group_id));
      const detailed=await route('admin/fpo').GET(request('reviewer',null,'GET','/api/admin/fpo?details=true&group='+group.group_id));
      assert.equal(detailed.status,200);assert.equal(detailed.headers.get('cache-control'),'private, no-store');
      const exported=(await detailed.json()).farmers;assert(exported.length>0);
      for(const farmer of exported){
        const [saved]=await db`SELECT email,phone FROM "user" WHERE id=${farmer.id}`;
        assert.equal(farmer.profile_details.email,saved.email);assert.equal(farmer.profile_details.phone,saved.phone);
        assert(!('password' in farmer.profile_details));
      }
    }
    assert.equal((await route('admin/fpo/messages').GET(request('coords',null,'GET','/api/admin/fpo/messages?group='+chennai.group_id))).status,403);
    assert.equal((await route('admin/fpo').GET(request('coords',null,'GET'))).status,403);
    assert.equal((await route('admin/fpo').GET(request('coords',null,'GET','/api/admin/fpo?details=true'))).status,403);
    assert.equal((await route('admin/fpo').GET(request(null,null,'GET','/api/admin/fpo?details=true'))).status,401);
    assert.equal((await route('admin/fpo/messages').GET(request(null,null,'GET','/api/admin/fpo/messages?group='+madurai.group_id))).status,401);
    assert.equal((await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='reviewer'`).length,0);
  });
  await test('Admin can create FPOs but cannot update, assign or publish',async()=>{
    assert.equal((await fpos.POST(request('reviewer',{state:'Tamil Nadu',district:'Coimbatore'}))).status,201);
    assert.equal((await fpos.PATCH(request('reviewer',{id:chennai.id,status:'active'},'PATCH'))).status,403);
    assert.equal((await route('admin/fpo').POST(request('reviewer',{action:'assign',farmer_id:'coords',state:'Tamil Nadu',district:'Chennai'}))).status,403);
    assert.equal((await announcements.POST(request('reviewer',{title:'No',body:'No',groupId:madurai.group_id}))).status,403);
  });
  await test('Admin message history paginates and includes expired announcements',async()=>{
    await db`INSERT INTO announcements(title,body,created_by,group_id,expires_at) SELECT 'Archived '||n,'History','admin',${madurai.group_id},now()-interval '1 day' FROM generate_series(1,51) n`;
    const first=await (await route('admin/fpo/messages').GET(request('reviewer',null,'GET','/api/admin/fpo/messages?group='+madurai.group_id))).json();
    const second=await (await route('admin/fpo/messages').GET(request('reviewer',null,'GET','/api/admin/fpo/messages?group='+madurai.group_id+'&offset='+first.next))).json();
    assert.equal(first.messages.length,50);assert.equal(first.next,50);assert.equal(second.next,null);
    assert(first.messages.some(m=>m.title.startsWith('Archived')));
    assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,first.messages.length+second.messages.length);
  });
  await test('Saved profile addresses match without geocoder and ambiguous districts stay pending',async()=>{
    delete process.env.FPO_GEOCODER_URL;
    await user('profile-text','farmer',true,'Madurai, Tamil Nadu, India',13.08,80.27);
    const result=await assignment.processFarmer('profile-text');
    assert.equal(result.group_id,madurai.group_id);assert.equal(result.assignment_source,'address');
    await user('ambiguous-text','farmer',true,'Madurai, Chennai, Tamil Nadu');
    assert.equal((await assignment.processFarmer('ambiguous-text')).assignment_status,'pending_location');
    await user('gps-only','farmer',true,null,9.9,78.1);
    assert.equal((await assignment.processFarmer('gps-only')).assignment_status,'pending_location');
    await user('partial-place','farmer',true,'Maduraiwest, Tamil Nadu');
    assert.equal((await assignment.processFarmer('partial-place')).assignment_status,'pending_location');
  });
  await test('GPS and nearby-style updates cannot move an assigned farmer; saved district updates can',async()=>{
    const r=await profiles.PUT(request('profile-text',{userId:'profile-text',latitude:13.08,longitude:80.28,location:'Chennai, Tamil Nadu'},'PUT'));
    assert.equal(r.status,200);assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='profile-text'`)[0].group_id,madurai.group_id);
    assert.equal((await assignment.processFarmer('profile-text')).group_id,madurai.group_id);
    await fpos.PATCH(request('admin',{id:chennai.id,status:'active'},'PATCH'));
    const move=await profiles.PUT(request('profile-text',{userId:'profile-text',state:'Tamil Nadu',district:'Chennai'},'PUT'));
    assert.equal(move.status,200);const profile=await move.json();assert.equal(profile.district,'Chennai');assert.equal(profile.state,'Tamil Nadu');
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='profile-text'`)[0].group_id,chennai.group_id);
  });
  await test('Saved district without assignment is preserved and FPO creation enrolls pending profiles',async()=>{
    await db`INSERT INTO fpo_districts(state,district,source) VALUES('Tamil Nadu','Salem','fixture')`;
    const [district]=await db`SELECT id FROM fpo_districts WHERE district='Salem'`;
    await user('saved-district','farmer',true,'Unresolvable village');
    await db`UPDATE "user" SET district_id=${district.id} WHERE id='saved-district'`;
    const preview=await assignment.processFarmer('saved-district',true);assert.equal(preview.assignment_status,'pending_fpo');
    assert.equal((await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='saved-district'`).length,0);
    await assignment.processFarmer('saved-district');
    const response=await fpos.POST(request('reviewer',{state:'Tamil Nadu',district:'Salem'}));assert.equal(response.status,201);
    const created=await response.json();assert.equal(created.assigned_count,1);
    const [membership]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='saved-district'`;assert.equal(membership.group_id,created.group_id);
  });
  await test('Concurrent profile district change is never overwritten by backfill',async()=>{
    await user('concurrent-profile','farmer',true,'Village without district');
    process.env.FPO_GEOCODER_URL='https://geocoder.test/';
    global.fetch=async()=>{
      const changed=await profiles.PUT(request('concurrent-profile',{userId:'concurrent-profile',state:'Tamil Nadu',district:'Chennai'},'PUT'));assert.equal(changed.status,200);
      return Response.json([{address:{country_code:'in',state:'Tamil Nadu',state_district:'Madurai'}}]);
    };
    try {await assert.rejects(()=>assignment.processFarmer('concurrent-profile'),/Profile changed/);}
    finally {global.fetch=nativeFetch;delete process.env.FPO_GEOCODER_URL;}
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='concurrent-profile'`)[0].group_id,chennai.group_id);
  });
  await test('GPS-only profile updates do not infer a new district',async()=>{
    const response=await profiles.PUT(request('gps-only',{userId:'gps-only',latitude:13.08,longitude:80.27},'PUT'));
    assert.equal(response.status,200);
    const [record]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='gps-only'`;
    assert.equal(record.group_id,null);assert.equal(record.district_id,null);
  });
  await test('Profile read exposes saved State and District for editing',async()=>{
    const req=request('profile-text',null,'GET','/api/users/profile?userId=profile-text');
    req.nextUrl=new URL(req.url);
    const response=await profiles.GET(req);assert.equal(response.status,200);
    const data=await response.json();assert.equal(data.state,'Tamil Nadu');assert.equal(data.district,'Chennai');
  });
  await test('Catalogue provisioning requires Super Admin and preserves existing FPOs',async()=>{
    const adminRoute=route('admin/fpo');
    for(const [actor,status] of [[null,401],['new-m',403],['reviewer',403]])
      assert.equal((await adminRoute.POST(request(actor,{action:'provision'}))).status,status);
    await db`INSERT INTO fpo_districts(state,district,source) VALUES('Tamil Nadu','Empty district','fixture'),('Tamil Nadu','Bulk district','fixture')`;
    const [district]=await db`SELECT id FROM fpo_districts WHERE district='Bulk district'`;
    await user('bulk-farmer');await db`UPDATE "user" SET district_id=${district.id} WHERE id='bulk-farmer'`;
    await db`UPDATE digital_fpos SET status='inactive' WHERE id=${madurai.id}`;
    const before=await db`SELECT * FROM digital_fpos ORDER BY id`;
    const responses=await Promise.all([1,2].map(()=>adminRoute.POST(request('admin',{action:'provision'}))));
    for(const response of responses)assert.equal(response.status,200,await response.text());
    const [counts]=await db`SELECT (SELECT count(*) FROM fpo_districts)::int districts,(SELECT count(*) FROM digital_fpos)::int fpos,(SELECT count(*) FROM farmer_groups)::int groups`;
    assert.equal(counts.districts,counts.fpos);assert.equal(counts.fpos,counts.groups);
    for(const old of before)assert.deepEqual((await db`SELECT * FROM digital_fpos WHERE id=${old.id}`)[0],old);
    const rerun=await (await adminRoute.POST(request('admin',{action:'provision'}))).json();assert.equal(rerun.created,0);assert.equal(rerun.groups_created,0);
    const assigned=await assignment.processFarmer('bulk-farmer');assert.equal(assigned.assignment_status,'assigned');
    assert.equal(String(assigned.district_id),String(district.id));
    assert.equal((await assignment.processFarmer('gps-only')).assignment_status,'pending_location');
    await user('future-bulk','buyer',false);
    assert.equal((await profiles.POST(request('future-bulk',{userId:'future-bulk',role:'farmer',state:'Tamil Nadu',district:'Bulk district'}))).status,200);
    assert.equal((await db`SELECT group_id FROM farmer_fpo_assignments WHERE farmer_id='future-bulk'`)[0].group_id,assigned.group_id);
  });
  await test('Taluk and state resolve through the directory, with conflicts kept pending',async()=>{
    const location=require('../lib/fpo-location.ts');
    const catalogue=await db`SELECT id,state,district FROM fpo_districts`;
    const m=catalogue.find(d=>d.district==='Madurai'),c=catalogue.find(d=>d.district==='Chennai');
    const mappings=[{district_id:m.id,name:'Melur'},{district_id:m.id,name:'Shared Taluk'},{district_id:c.id,name:'Shared Taluk'}];
    assert.equal(location.matchProfileAddress('Melur Taluk, Tamil Nadu',catalogue,mappings).district.id,m.id);
    assert.equal(location.matchProfileAddress('Melur',catalogue,mappings).district,null);
    assert.equal(location.matchProfileAddress('NotMelur, Tamil Nadu',catalogue,mappings).district,null);
    assert.equal(location.matchProfileAddress('Melur, Chennai, Tamil Nadu',catalogue,mappings).ambiguous,true);
    assert.equal(location.matchProfileAddress('Shared Taluk, Tamil Nadu',catalogue,mappings).ambiguous,true);
    assert.equal(location.matchProfileAddress('Melur, Madurai, Tamil Nadu',catalogue,mappings).district.id,m.id);
    await db`INSERT INTO fpo_subdistricts(district_id,name,source) VALUES(${m.id},'Melur','fixture')`;
    await user('taluk-farmer','farmer',true,'Melur Taluk, Tamil Nadu');
    const preview=await assignment.processFarmer('taluk-farmer',true);assert.equal(preview.district.id,m.id);
    assert.equal((await db`SELECT district_id FROM "user" WHERE id='taluk-farmer'`)[0].district_id,null);
    await assignment.processFarmer('taluk-farmer');
    assert.equal((await db`SELECT district_id FROM "user" WHERE id='taluk-farmer'`)[0].district_id,m.id);
    await db`UPDATE "user" SET district_id=${c.id} WHERE id='taluk-farmer'`;
    assert.equal((await assignment.processFarmer('taluk-farmer')).district_id,c.id);
  });
  await test('Bundled Omalur mapping resolves the exact saved address omalur ,tamilnadu',async()=>{
    const directory=JSON.parse(fs.readFileSync(path.join(root,'data/fpo-subdistricts.json'),'utf8'));
    for(const entry of directory.districts){
      const [parent]=await db`SELECT id FROM fpo_districts WHERE state=${entry.state} AND district=${entry.district}`;
      assert(parent);
      for(const name of entry.names)await db`INSERT INTO fpo_subdistricts(district_id,name,source) VALUES(${parent.id},${name},${entry.source}) ON CONFLICT DO NOTHING`;
    }
    await user('omalur-farmer','farmer',true,'omalur ,tamilnadu');
    const preview=await assignment.processFarmer('omalur-farmer',true);
    assert.equal(preview.district.district,'Salem');assert.equal(preview.assignment_status,'assigned');
    const applied=await assignment.processFarmer('omalur-farmer');assert.equal(applied.group_id,preview.group_id);
    const repeated=await assignment.processFarmer('omalur-farmer');assert.equal(repeated.group_id,applied.group_id);
    const location=require('../lib/fpo-location.ts');
    const catalogue=await db`SELECT id,state,district FROM fpo_districts`;
    const mappings=await db`SELECT district_id,name FROM fpo_subdistricts`;
    assert.equal(location.matchProfileAddress('Omalur Taluk, Tamil Nadu',catalogue,mappings).district.district,'Salem');
    assert.equal(location.matchProfileAddress('Omalur, Chennai, Tamilnadu',catalogue,mappings).ambiguous,true);
    assert.equal(location.matchProfileAddress('Omalur, Tamilnadux',catalogue,mappings).district,null);
  });
  await test('Repeated locality names require agreeing district or taluk evidence',async()=>{
    const location=require('../lib/fpo-location.ts');
    const catalogue=await db`SELECT id,state,district FROM fpo_districts`;
    const salem=catalogue.find(d=>d.district==='Salem'),chennai=catalogue.find(d=>d.district==='Chennai');
    const places=[{district_id:salem.id,name:'Shared Village'},{district_id:chennai.id,name:'Shared Village'},
      {district_id:salem.id,name:'Omalur'},{district_id:chennai.id,name:'Other Locality'}];
    assert.equal(location.matchProfileAddress('Shared Village, Tamil Nadu',catalogue,places).ambiguous,true);
    assert.equal(location.matchProfileAddress('Shared Village, Omalur, Tamil Nadu',catalogue,places).district.id,salem.id);
    assert.equal(location.matchProfileAddress('Shared Village, Chennai, Tamil Nadu',catalogue,places).district.id,chennai.id);
    assert.equal(location.matchProfileAddress('Omalur, Other Locality, Tamil Nadu',catalogue,places).ambiguous,true);
    assert.equal(location.matchProfileAddress('Omalur, Salem, Chennai, Tamil Nadu',catalogue,places).ambiguous,true);
    assert.equal(location.matchProfileAddress('Shared Village',catalogue,places).district,null);
    assert.equal(location.addressPhrases('a '.repeat(81)).length,0);
    assert.notEqual(location.addressWords('कला'),location.addressWords('कल'));
    await db`INSERT INTO fpo_localities(district_id,kind,code,name,name_key,source)
      VALUES(${salem.id},'village','999001','Indexed Village','indexed village','fixture')`;
    await user('indexed-locality','farmer',true,'Indexed Village, Tamilnadu');
    const preview=await assignment.processFarmer('indexed-locality',true);
    assert.equal(preview.district.id,salem.id);
    const applied=await assignment.processFarmer('indexed-locality');
    assert.equal(applied.assignment_status,'assigned');assert.equal(applied.group_id,preview.group_id);
  });
  console.log(`${passed} integration tests passed`);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.unsafe('DROP SCHEMA IF EXISTS fpo_integration CASCADE');await db.end();});
