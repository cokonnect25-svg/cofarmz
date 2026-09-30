const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
let actor={id:'admin',role:'admin'},queries=0;
class FpoError extends Error{constructor(m,status=400){super(m);this.status=status;}}
const m=new Module('announcement-access',module);
m.require=n=>n==='@/app/api/utils/sql'?{default:async()=>{queries++;return [];}}:n==='@/lib/fpo-access'?{FpoError,requireActor:async()=>actor,canReviewFpos:r=>['admin','superadmin','super_admin'].includes(r),isSuperAdmin:r=>['superadmin','super_admin'].includes(r),fpoError:e=>({status:e.status||500})}:n==='@/lib/fpo-announcements'?{deliverAnnouncement:async()=>{throw Error('Unexpected push');}}:n==='next/server'?{NextResponse:{json:(data,o={})=>({status:o.status||200,data})}}:require(n);
m._compile(ts.transpileModule(fs.readFileSync('app/api/admin/announcements/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,'announcement-access');
const post=b=>m.exports.POST(new Request('http://localhost/',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}));
(async()=>{
  for(const groupId of [null,'',false,123])assert.equal((await post({title:'Title',body:'Body',groupId})).status,403);
  assert.equal(queries,0);
  // Authorized admin passes role gate; missing/inactive group is still rejected.
  assert.equal((await post({title:'Title',body:'Body',groupId:'12345678-1234-1234-1234-123456789abc'})).status,400);
  assert(queries>0);queries=0;actor={id:'farmer',role:'farmer'};
  assert.equal((await post({title:'Title',body:'Body',groupId:'12345678-1234-1234-1234-123456789abc'})).status,403);
  assert.equal(queries,0);
  console.log('PASS: admin group publishing gate, global publishing restricted, invalid/inactive group and farmer rejection');
})().catch(e=>{console.error(e);process.exitCode=1;});
