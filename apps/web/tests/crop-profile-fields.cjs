const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
let actor={id:'farmer',role:'farmer'}, stored={user_id:'farmer',crop_name:'Rice'}, queries=[];
class FpoError extends Error { constructor(message,status=400){super(message);this.status=status;} }
const sql=async(parts,...values)=>{
  const query=parts.join('?');queries.push({query,values});
  if(query.includes('SELECT user_id, crop_name')) return stored?[stored]:[];
  if(query.includes('SELECT name FROM')) return [{name:'Member'}];
  if(/INSERT INTO crops|UPDATE crops/.test(query)) return [{id:1,comment:values.find(v=>v==='Delivery after harvest')||null,cultivated_acres:values.includes(2.5)?2.5:null}];
  return [];
};
function load(file){
  const m=new Module(file,module);
  m.require=name=>{
    if(name==='@/app/api/utils/sql')return {__esModule:true,default:sql};
    if(name==='@/lib/fpo-access')return {FpoError,requireActor:async()=>{if(!actor)throw new FpoError('Sign in required',401);return actor;},fpoError:e=>Response.json({error:e.message},{status:e.status})};
    if(name==='@/app/api/utils/crop-match-push')return {sendCropMatchPushes:async()=>{}};
    if(name==='@/app/api/utils/push')return {sendPushToFollowers:async()=>{}};
    if(name.startsWith('@/'))return load(path.join('.',name.slice(2)+'.ts'));
    return require(name);
  };
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
  return m.exports;
}
const {validateCropProfileFields:validate}=load('lib/crop-profile-fields.ts');
assert.deepEqual(validate({comment:' hello ',cultivated_acres:'2.5'},'farmer'),{comment:'hello',cultivated_acres:2.5});
assert.deepEqual(validate({comment:'  ',cultivated_acres:''},'buyer'),{comment:null,cultivated_acres:null});
for(const value of [0,-1,Infinity,NaN,true,{},'abc',' ','1e3'])assert.throws(()=>validate({cultivated_acres:value},'farmer'));
assert.throws(()=>validate({cultivated_acres:2},'buyer'),/Only farmers/);
assert.throws(()=>validate({comment:'a'.repeat(2001)},'farmer'),/2000/);
assert.throws(()=>validate({comment:42},'buyer'),/text/);
const routes=load('app/api/farmer-crops/route.ts');
const request=(method,extra={})=>new Request('http://localhost/api/farmer-crops',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:1,user_id:actor?.id||'farmer',crop_name:'Rice',expected_yield_date:'2026-12-31',...extra})});
(async()=>{
  for(const method of ['POST','PUT']){
    actor={id:'farmer',role:'farmer'};stored={user_id:'farmer',crop_name:'Rice'};queries=[];
    let response=await routes[method](request(method,{comment:'Delivery after harvest',cultivated_acres:2.5}));
    assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:1,comment:'Delivery after harvest',cultivated_acres:2.5});
    assert(queries.some(q=>/INSERT INTO crops|UPDATE crops/.test(q.query)&&q.values.includes(2.5)&&q.values.includes('Delivery after harvest')));
    for(const fields of [{cultivated_acres:-2},{comment:'x'.repeat(2001)}]){
      queries=[];assert.equal((await routes[method](request(method,fields))).status,400);assert(!queries.some(q=>/INSERT INTO crops|UPDATE crops/.test(q.query)));
    }
    actor={id:'buyer',role:'buyer'};stored={user_id:'buyer',crop_name:'Rice'};
    assert.equal((await routes[method](request(method,{comment:'Delivery after harvest'}))).status,200);
    queries=[];assert.equal((await routes[method](request(method,{cultivated_acres:1}))).status,400);assert(!queries.some(q=>/INSERT INTO crops|UPDATE crops/.test(q.query)));
    actor={id:'intruder',role:'farmer'};stored={user_id:'victim',crop_name:'Rice'};
    queries=[];assert.equal((await routes[method](request(method,{user_id:'victim'}))).status,403);assert(!queries.some(q=>/INSERT INTO crops|UPDATE crops/.test(q.query)));
    actor=null;assert.equal((await routes[method](request(method))).status,401);
  }
  actor={id:'farmer',role:'farmer'};stored={user_id:'farmer',crop_name:'Rice'};queries=[];
  assert.equal((await routes.PUT(request('PUT',{comment:null,cultivated_acres:null}))).status,200);
  const update=queries.find(q=>q.query.includes('UPDATE crops'));assert(update.query.includes('comment')&&update.query.includes('cultivated_acres'));
  queries=[];await routes.GET(new Request('http://localhost/api/farmer-crops?user_id=farmer'));
  assert(queries.some(q=>q.query.includes('SELECT')&&q.query.includes('comment, cultivated_acres')));
  console.log('PASS: farmer/buyer comments, fractional acreage, invalid fields, owner access, clearing and crop reads');
})().catch(e=>{console.error(e);process.exitCode=1;});
