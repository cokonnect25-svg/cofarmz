const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
let actor = {id:'manager'}, manager = null, queries = [];
class FpoError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const sql = async (parts,...values) => {
  const query = parts.join('?'); queries.push({query,values});
  if(query.includes('FROM fpo_manager_accounts')) return manager ? [manager] : [];
  if(query.includes('FROM farmer_fpo_assignments')) return [{id:'farmer',name:'Assigned farmer'}];
  if(query.includes('SELECT id,password FROM account')) return [{id:'account',password:await crypto.hashPassword('temporary-password')}];
  return [];
};
sql.begin = fn => fn(sql);
let crypto;
function load(file){
  const mod = new Module(file,module);
  mod.require = name => {
    if(name==='@/app/api/utils/sql') return {__esModule:true,default:sql};
    if(name==='better-auth/crypto') return crypto;
    if(name==='@/lib/fpo-access') return {FpoError,requireActor:async()=>{if(!actor)throw new FpoError('Sign in required',401);return actor;},requireFpoReviewer:async()=>{if(!actor)throw new FpoError('Sign in required',401);if(!['admin','superadmin'].includes(actor.role))throw new FpoError('Admin access required',403);return actor;},fpoError:e=>Response.json({error:e.message},{status:e.status||500})};
    return require(name);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
  return mod.exports;
}
function request(body){return new Request('http://localhost/api/test',{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
(async()=>{
  crypto=await import('better-auth/crypto');
  const dashboard=load('app/api/fpo/manager/route.ts'),credentials=load('app/api/admin/fpo/credentials/route.ts');
  assert.equal((await credentials.POST(request({}))).status,403);
  actor=null; assert.equal((await dashboard.GET(request())).status,401);
  actor={id:'manager'};assert.equal((await dashboard.GET(request())).status,403);
  manager={user_id:'manager',group_id:'assigned-group',status:'active',must_change_password:true};queries=[];
  let response=await dashboard.GET(request());assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual((await response.json()).farmers,[]);assert(!queries.some(q=>q.query.includes('FROM farmer_fpo_assignments')));
  manager.must_change_password=false;response=await dashboard.GET(request());assert.equal((await response.json()).farmers.length,1);assert(queries.some(q=>q.query.includes('can_receive_fpo_message')&&q.values.includes('assigned-group')));
  manager.status='inactive';assert.deepEqual((await (await dashboard.GET(request())).json()).farmers,[]);
  assert.equal((await dashboard.POST(request({currentPassword:'temporary-password',newPassword:'short'}))).status,400);
  queries=[];assert.equal((await dashboard.POST(request({currentPassword:'wrong-password',newPassword:'new-secure-password'}))).status,400);assert(!queries.some(q=>q.query.startsWith('UPDATE')));
  queries=[];assert.equal((await dashboard.POST(request({currentPassword:'temporary-password',newPassword:'new-secure-password'}))).status,200);
  const update=queries.find(q=>q.query.startsWith('UPDATE account'));assert(await crypto.verifyPassword({hash:update.values[0],password:'new-secure-password'}));assert(queries.some(q=>q.query.includes('must_change_password=false')));assert(queries.some(q=>q.query.startsWith('DELETE FROM session')));
  actor={id:'admin',role:'admin'};assert.equal((await credentials.POST(request({fpoId:'invalid',action:'create',email:'a@example.com'}))).status,400);
  console.log('PASS: reviewer access, manager assignment, mandatory password change, inactive FPO, scoped farmers, real password hashing/verification, session revocation');
})().catch(e=>{console.error(e);process.exitCode=1;});
