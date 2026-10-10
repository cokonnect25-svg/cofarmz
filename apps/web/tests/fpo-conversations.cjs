const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const Module=require('node:module');
let actor={id:'farmer-a',role:'farmer'},queries=[],results=[];
class FpoError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const sql=async(parts,...values)=>{queries.push({query:parts.join('?'),values});return results.shift()||[];};
const m=new Module('conversations-test',module);
m.require=name=>name==='@/app/api/utils/sql'?{default:sql}:name==='@/lib/fpo-access'?{
  requireActor:async()=>{if(!actor)throw new FpoError('Sign in required',401);return actor;},
  canReviewFpos:role=>['admin','superadmin','super_admin'].includes(role),FpoError,
  fpoError:e=>({status:e.status||500,data:{error:e.message}}),
}:name==='next/server'?{NextResponse:{json:(data,options={})=>({data,status:options.status||200,headers:options.headers})}}:require(name);
m._compile(ts.transpileModule(fs.readFileSync('app/api/digital-fpos/conversations/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,'conversations-test');
const {GET,POST}=m.exports;
const id='12345678-1234-1234-1234-123456789abc';
const get=q=>GET(new Request('http://localhost/api/digital-fpos/conversations'+q));
const post=body=>POST(new Request('http://localhost/api/digital-fpos/conversations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));
(async()=>{
  results=[[{id,name:'FPO',status:'active'}],[{id:'message',body:'Hello'}]];
  const history=await get(`?fpoId=${id}&farmerId=other-farmer`);
  assert.equal(history.status,200);
  assert.equal(history.headers['Cache-Control'],'private, no-store');
  assert(queries.every(q=>!q.values.includes('other-farmer')));
  assert(queries[1].values.includes('farmer-a'));
  assert(queries[1].query.includes('COALESCE(recipient_id,sender_id)'));
  assert(queries[1].query.includes('ORDER BY created_at DESC,id DESC'));
  queries=[];results=[Array.from({length:51},(_,i)=>({id:i}))];
  const list=await get('');assert.equal(list.data.threads.length,50);assert.equal(list.data.next,50);
  assert.deepEqual(queries[0].values,[false,'farmer-a',null,null,0]);
  assert.equal((await get('?offset=-1')).status,400);
  assert.equal((await get('?fpoId=bad')).status,400);
  results=[[]];assert.equal((await get(`?fpoId=${id}`)).status,404);
  assert.equal((await post({fpoId:id,farmerId:'farmer-a',body:'spoof reply'})).status,403);
  actor={id:'admin-a',role:'admin'};queries=[];results=[[{id:'saved'}]];
  assert.equal((await post({fpoId:id,farmerId:'farmer-a',body:' Reply ',sender_id:'spoof'})).status,201);
  assert.deepEqual(queries[0].values,['admin-a','farmer-a','Reply',id,'farmer-a']);
  assert(queries[0].query.includes("f.status='active'"));
  assert(queries[0].query.includes('m.recipient_id IS NULL'));
  for(const body of ['',123,'x'.repeat(5001)])assert.equal((await post({fpoId:id,farmerId:'farmer-a',body})).status,400);
  assert.equal((await post(null)).status,400);
  results=[[]];assert.equal((await post({fpoId:id,farmerId:'farmer-a',body:'Hi'})).status,404);
  actor={id:'taluk-manager',role:'fpo'};queries=[];
  const sibling='22345678-1234-1234-1234-123456789abc';
  results=[[{digital_fpo_id:id}]];
  assert.equal((await get(`?fpoId=${sibling}&farmerId=farmer-a`)).status,403);
  assert.equal(queries.length,1,'Reject sibling FPO before reading messages');
  results=[[{digital_fpo_id:id}]];
  assert.equal((await post({fpoId:sibling,farmerId:'farmer-a',body:'No'})).status,403);
  queries=[];results=[[{digital_fpo_id:id}],[]];
  assert.equal((await get('')).status,200);
  assert(queries[1].query.includes('m.digital_fpo_id='));
  assert.deepEqual(queries[1].values,[true,'taluk-manager',id,id,0]);
  results=[[{digital_fpo_id:id}],[{id:'saved'}]];
  assert.equal((await post({fpoId:id,farmerId:'outside-taluk-farmer',body:'Reply to private contact'})).status,201);
  results=[[]];assert.equal((await get('')).status,403,'No access before password change or when inactive');
  actor={id:'buyer',role:'buyer'};assert.equal((await get('')).status,403);
  actor=null;assert.equal((await get('')).status,401);
  console.log('PASS: farmer conversation isolation, history, pagination, admin replies, forged sender rejection, inactive/missing threads and input validation');
})().catch(e=>{console.error(e);process.exitCode=1;});
