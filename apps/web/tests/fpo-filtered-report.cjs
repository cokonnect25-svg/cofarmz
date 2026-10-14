const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
let actor = { id: 'admin', role: 'admin' }, manager = null, queries = [];
const parent = { id:'parent', group_id:'11111111-1111-1111-1111-111111111111', district_id:'1', taluk_id:null, district:'A', state:'S' };
const child = { ...parent, id:'child', group_id:'22222222-2222-2222-2222-222222222222', taluk_id:'10', taluk:'Mandal A' };
const other = { ...parent, id:'other', group_id:'33333333-3333-3333-3333-333333333333', district_id:'2' };
class FpoError extends Error { constructor(message,status=400) { super(message); this.status=status; } }
const sql = async (parts,...values) => {
  const query=parts.join('?'); queries.push({query,values});
  if (query.includes('FROM fpo_manager_accounts')) return manager ? [manager] : [];
  if (query.includes('FROM digital_fpos f')) return [parent,child,other].filter(f=>!manager || (f.district_id===manager.district_id && (!manager.taluk_id || f.taluk_id===manager.taluk_id)));
  if (query.includes('FROM farmer_fpo_assignments')) return [{id:'farmer',name:'Farmer',group_id:child.group_id,taluk:'Mandal A'}];
  throw new Error('Unexpected query');
};
function load(file) {
  const mod=new Module(file,module);
  mod.require=name=>name==='@/app/api/utils/sql'?{default:sql,__esModule:true}:name==='@/lib/fpo-access'?{
    FpoError,canReviewFpos:role=>['admin','superadmin','super_admin'].includes(role),
    requireActor:async()=>{if(!actor)throw new FpoError('Sign in required',401);return actor;},
    fpoError:e=>Response.json({error:e.message},{status:e.status||500}),
  }:require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
  return mod.exports;
}
const {GET}=load('app/api/fpo/report/route.ts');
const get=q=>GET(new Request('http://localhost/api/fpo/report?'+q));
(async()=>{
  let r=await get('district=1&taluk=10'); assert.equal(r.status,200); assert.deepEqual((await r.json()).fpos,[child]);
  assert.deepEqual(queries.at(-1).values[0],[child.group_id]);
  r=await get('group='+parent.group_id); assert.equal((await r.json()).fpos.length,2);
  assert.equal((await get('district=invalid')).status,400);
  actor=null; assert.equal((await get('')).status,401);
  actor={id:'farmer',role:'farmer'}; assert.equal((await get('')).status,403);
  actor={id:'manager',role:'fpo_manager'};
  manager={district_id:'1',taluk_id:null,status:'active',must_change_password:false};
  assert.equal((await get('district=2')).status,403);
  assert.equal((await get('group='+other.group_id)).status,403);
  r=await get('taluk=10'); assert.equal(r.status,200); assert.deepEqual((await r.json()).fpos,[child]);
  assert(queries.at(-1).query.includes('u.district_id=') && queries.at(-1).values.includes('1'));
  manager.taluk_id='10'; assert.equal((await get('taluk=11')).status,403);
  manager.status='inactive'; assert.equal((await get('options=true')).status,403);
  manager.status='active';manager.must_change_password=true;assert.equal((await get('')).status,403);
  manager.must_change_password=false;r=await get('options=true');assert.deepEqual((await r.json()).fpos,[child]);assert.equal(r.headers.get('cache-control'),'private, no-store');
  const {loadFilteredFpoReport,renderFarmerCsv}=load('lib/fpo-report.ts');
  const calls=[];
  const report=await loadFilteredFpoReport(async url=>{calls.push(url);return {fpos:[child],farmers:[{id:String(calls.length)}],next:calls.length===1?'cursor & 100':null};},{district:'1',taluk:'10'});
  assert.equal(report.farmers.length,2);assert.equal(new URL(calls[1],'http://localhost').searchParams.get('after'),'cursor & 100');
  assert(calls.every(url=>new URL(url,'http://localhost').searchParams.get('taluk')==='10'));
  await assert.rejects(loadFilteredFpoReport(async()=>({fpos:[],farmers:[],next:'repeat'}),{}),/complete farmer list/);
  const csv=renderFarmerCsv([{id:'1',name:'=FORMULA',taluk:'A,"B"',profile_details:{phone:'+911234'}}]);
  assert(csv.includes("\"'=FORMULA\""));assert(csv.includes('"A,""B"""'));assert(csv.includes("\"'+911234\""));assert(csv.startsWith('\uFEFF'));
  console.log('PASS: district/taluk filtering, manager boundaries, inactive/password gates, pagination, CSV escaping');
})().catch(e=>{console.error(e);process.exitCode=1;});
