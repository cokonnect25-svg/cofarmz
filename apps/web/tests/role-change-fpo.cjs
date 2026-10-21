const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
class FpoError extends Error { constructor(message, status=400) { super(message); this.status=status; } }
function load(file, mocks) {
  const mod = new Module(file,module);
  mod.require = key => key in mocks ? mocks[key] : require(key);
  const result = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  mod._compile(result.outputText,file);
  return mod.exports;
}
let user, pending, assignment, resolvedCalls, talukCalls, actor='admin', fail=false;
const sql = async (parts,...v) => {
  const q=parts.join('?').replace(/\s+/g,' ').trim();
  if(q.startsWith('CREATE')) return [];
  if(q.startsWith('SELECT 1')) return [{id:1}];
  if(q.includes('FROM role_change_requests')) return pending.status==='pending' ? [pending] : [];
  if(q.startsWith('SELECT * FROM "user"')) return [user];
  if(q.startsWith('UPDATE "user" SET role')) { user.role=v[0]; user.district_id=v[2]; return []; }
  if(q.startsWith('UPDATE "user" SET taluk_id')) {user.taluk_id=v[0];return [];}
  if(q.startsWith('SELECT f.status')) return [{status:'active',id:'group'}];
  if(q.startsWith('INSERT INTO farmer_fpo_assignments')) {
    if(fail) throw new Error('assignment unavailable');
    assignment={district:v[1],taluk:v[2],group:v[3],status:v[4]}; return [assignment];
  }
  if(q.startsWith('UPDATE role_change_requests')) {pending.status=v[0];return [];}
  throw new Error('Unexpected query: '+q);
};
sql.begin=async fn=>{const before=structuredClone({user,pending,assignment});try{return await fn(sql);}catch(e){({user,pending,assignment}=before);throw e;}};
const assignmentLib=load('lib/fpo-assignment.ts',{
  '@/app/api/utils/sql':{default:sql}, './fpo-error':{FpoError},
  './fpo-location':{},
  './fpo-taluk':{resolveTaluk:async u=>{talukCalls++;return u.taluk_id || 'resolved-taluk';},ensureTalukFpo:async()=>{}},
});
const route=load('app/api/role-change-requests/route.ts',{
  '@/lib/fpo-access':{FpoError,requireActor:async()=>({id:actor}),fpoError:e=>Response.json({error:e.message},{status:e.status||500})},
  '@/lib/fpo-assignment':assignmentLib,
  '@/lib/fpo-location':{resolveLegacyLocation:async()=>{resolvedCalls++;return {district:user.location?{id:'resolved-district'}:null,source:'legacy',reason:null};}},
  '@/app/api/utils/sql':{default:sql},
  '@/app/api/utils/push':{sendPushToUser:async()=>{throw new Error('push unavailable');}},
  'next/server':{NextResponse:Response},
});
function reset(role,district='saved-district') {
  user={id:'user',role,district_id:district,taluk_id:'saved-taluk',location:'Saved address'};
  pending={id:1,user_id:'user',requested_role:role==='farmer'?'buyer':'farmer',status:'pending'};
  assignment={group:role==='farmer'?'old-group':null};resolvedCalls=0;talukCalls=0;fail=false;actor='admin';
}
const review=action=>route.PATCH(new Request('https://example.com/api/role-change-requests',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({adminId:'admin',requestId:1,action})}));
(async()=>{
  reset('farmer'); assert.equal((await review('approved')).status,200);
  assert.equal(user.role,'buyer');assert.equal(assignment.group,null);assert.equal(assignment.status,'not_farmer');assert.equal(talukCalls,0);
  assert.equal(user.taluk_id,'saved-taluk');assert.equal(user.district_id,'saved-district');
  assert.equal((await review('approved')).status,409);
  reset('buyer');assert.equal((await review('approved')).status,200);
  assert.equal(assignment.group,'group');assert.equal(assignment.district,'saved-district');assert.equal(resolvedCalls,0);
  reset('buyer',null);assert.equal((await review('approved')).status,200);assert.equal(assignment.district,'resolved-district');assert.equal(resolvedCalls,1);
  reset('buyer',null);user.location=null;assert.equal((await review('approved')).status,200);assert.equal(assignment.status,'pending_location');assert.equal(assignment.group,null);
  reset('farmer');assert.equal((await review('rejected')).status,200);assert.equal(user.role,'farmer');assert.equal(assignment.group,'old-group');
  reset('farmer');fail=true;assert.equal((await review('approved')).status,500);assert.equal(user.role,'farmer');assert.equal(pending.status,'pending');assert.equal(assignment.group,'old-group');
  reset('farmer');actor='other';assert.equal((await review('approved')).status,403);assert.equal(pending.status,'pending');
  console.log('PASS: untag buyer; tag farmer by saved/resolved location; pending location; rejection; duplicate review; rollback; authorization; push failure does not undo approval');
})().catch(e=>{console.error(e);process.exitCode=1;});
