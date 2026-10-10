const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
let queries = [], currentDate;
const sql = async (parts,...values) => {
  const query = parts.join('?'); queries.push({query,values});
  if (query.includes('SELECT user_id, crop_name')) return [{user_id:'farmer',crop_name:'Rice'}];
  if (query.includes('SELECT name FROM')) return [{name:'Farmer'}];
  if (query.includes('INSERT INTO crops') || query.includes('UPDATE crops')) return [{id:1,crop_name:'Rice',expected_yield_date:currentDate,years_of_experience:20}];
  return [];
};
const nativeLoad = Module._load;
Module._load = function(name,parent,isMain) {
  if (name === '@/app/api/utils/sql') return {__esModule:true,default:sql};
  if (name === '@/app/api/utils/crop-match-push') return {sendCropMatchPushes:async()=>{}};
  if (name === '@/app/api/utils/push') return {sendPushToFollowers:async()=>{}};
  if (name.startsWith('@/')) name = path.join(root,name.slice(2));
  return nativeLoad.call(this,name,parent,isMain);
};
require.extensions['.ts'] = (mod,file) => mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,file);
const routes = require('../app/api/farmer-crops/route.ts');
const request = (method,date) => new Request('http://localhost/api/farmer-crops',{
  method,headers:{'Content-Type':'application/json'},
  body:JSON.stringify({id:1,user_id:'farmer',crop_name:'Rice',expected_yield_date:date}),
});
(async()=>{
  for (const method of ['POST','PUT']) {
    for (const date of [undefined,null,'',42,'2026-02-30','2026-02-29','2026-13-01','2026-1-2','0000-01-01','tomorrow']) {
      queries=[];
      const response=await routes[method](request(method,date));
      assert.equal(response.status,400,`${method} must reject ${date}`);
      assert.equal(queries.length,0,'Invalid date must be rejected before any database writes');
    }
    for (const date of ['2028-02-29','2026-12-31']) {
      queries=[];currentDate=date;
      const response=await routes[method](request(method,date));assert.equal(response.status,200);
      const crop=await response.json();assert.equal(crop.expected_yield_date,date);
      assert(!('years_of_experience' in crop),'Removed experience must not be returned');
      assert(queries.some(q=>q.values.includes(date)&&/INSERT INTO crops|UPDATE crops/.test(q.query)));
    }
  }
  console.log('PASS: add/edit require valid calendar yield dates, reject before writes, accept leap dates, and omit legacy experience');
})().catch(e=>{console.error(e);process.exitCode=1;});
