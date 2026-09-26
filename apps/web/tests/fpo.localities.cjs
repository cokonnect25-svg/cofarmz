// Full snapshot import and indexed lookup against an isolated local schema.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const {inspectSnapshot,importSnapshot}=require('../scripts/import-fpo-localities.cjs');
const root=path.resolve(__dirname,'..');
const url=process.env.FPO_TEST_DATABASE_URL||'postgres://postgres@127.0.0.1:55439/postgres';
if(!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Use an isolated local test DB');
const db=require('postgres')(url,{max:1,onnotice:()=>{},connection:{search_path:'fpo_localities_integration'}});
const compiled=ts.transpileModule(fs.readFileSync(path.join(root,'lib/fpo-location.ts'),'utf8'),
  {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const locationModule={exports:{}};
new Function('require','module','exports',compiled)(id=>id==='@/app/api/utils/sql'
  ?{__esModule:true,default:db}:{FpoError:class extends Error{}},locationModule,locationModule.exports);
const location=locationModule.exports;
(async()=>{
  await db.unsafe('CREATE SCHEMA fpo_localities_integration');
  await db.unsafe('CREATE TABLE fpo_districts(id BIGSERIAL PRIMARY KEY,state TEXT,district TEXT)');
  const catalogue=JSON.parse(fs.readFileSync(path.join(root,'data/fpo-districts.json'),'utf8')).districts;
  await db`INSERT INTO fpo_districts ${db(catalogue.map(({state,district})=>({state,district})))}`;
  await db.unsafe(fs.readFileSync(path.join(root,'migrations/20260925_fpo_subdistricts.sql'),'utf8'));
  await db.unsafe(fs.readFileSync(path.join(root,'migrations/20260925_fpo_localities.sql'),'utf8'));
  const snapshot=await inspectSnapshot();
  const imported=await importSnapshot(db,snapshot);
  assert.equal(imported.states,36);assert(imported.inserted>800000);
  console.log('PASS validated and imported full nationwide snapshot',imported.inserted);
  const [coverage]=await db`SELECT count(DISTINCT d.state)::int states,count(DISTINCT d.id)::int districts
    FROM fpo_localities l JOIN fpo_districts d ON d.id=l.district_id`;
  assert.equal(coverage.states,36);assert.equal(coverage.districts,784);
  const omalur=await location.resolveLegacyLocation({location:'omalur ,tamilnadu'});
  assert.equal(omalur.district?.district,'Salem');
  const rows=await db`SELECT DISTINCT ON(d.state,l.kind) d.state,d.district,l.kind,l.name
    FROM fpo_localities l JOIN fpo_districts d ON d.id=l.district_id
    WHERE l.name ~ '^[A-Za-z][A-Za-z ]{3,35}$'
    ORDER BY d.state,l.kind,length(l.name) DESC,l.name`;
  const covered=new Set();let resolved=0;
  for(const row of rows) {
    const result=await location.resolveLegacyLocation({location:row.name+', '+row.district+', '+row.state});
    // A conflicting place name is allowed to remain pending, never to join another district.
    if(result.district){
      assert.equal(result.district.state,row.state);assert.equal(result.district.district,row.district);
      covered.add(row.state);resolved++;
    }
  }
  assert.equal(covered.size,36,'No resolved sample for: '+[...new Set(catalogue.map(d=>d.state))].filter(s=>!covered.has(s)).join(', '));
  console.log('PASS locality lookup samples cover all 36 States/UTs;',resolved,'resolved samples');
  const before=(await db`SELECT count(*)::int n FROM fpo_localities`)[0].n;
  const rerun=await importSnapshot(db,snapshot);assert.equal(rerun.inserted,before);
  console.log('PASS repeated nationwide import preserves record count');
  // Missing parent must roll back the entire replacement, including its initial DELETE.
  await db`UPDATE fpo_districts SET district='Renamed for rollback test' WHERE district='Salem' AND state='Tamil Nadu'`;
  await assert.rejects(()=>importSnapshot(db,snapshot),/parent district missing/);
  assert.equal((await db`SELECT count(*)::int n FROM fpo_localities`)[0].n,before);
  console.log('PASS missing-parent import rolls back without losing the existing directory');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await db.unsafe('DROP SCHEMA IF EXISTS fpo_localities_integration CASCADE');await db.end();
});
