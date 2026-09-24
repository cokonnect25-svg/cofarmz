// Reuses the app's assignment functions without loading web authentication or printing user data.
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:8,connect_timeout:10});
const modules=new Map();
function load(name) {
 const key=path.basename(name).replace(/\.ts$/,'');
 if(!['fpo-assignment','fpo-location','fpo-error'].includes(key))throw new Error('Unsupported module');
 if(modules.has(key))return modules.get(key).exports;
 const module={exports:{}};modules.set(key,module);
 const source=fs.readFileSync(path.join(__dirname,'../lib',key+'.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',compiled)(id=>id==='@/app/api/utils/sql'?{__esModule:true,default:sql}:load(id),module,module.exports);
 return module.exports;
}
(async()=>{
 const apply=process.argv.includes('--apply');
 const {processFarmer,planFarmerAssignment}=load('fpo-assignment');
 const catalogue=await sql`SELECT id,state,district FROM fpo_districts`;
 const fpos=await sql`SELECT f.district_id,f.status,g.id AS group_id FROM digital_fpos f JOIN farmer_groups g ON g.digital_fpo_id=f.id`;
 const totals={processed:0,assigned:0,pending_fpo:0,pending_location:0,inactive_fpo:0,errors:0};
 const districts=new Map();const reasons=new Map();let after='';
 console.log(apply?'Applying saved-profile assignment backfill. No FPOs will be created.':'Preview only: no profiles or memberships will be changed.');
 while(true){
  const batch=await sql`SELECT u.*,a.assignment_source FROM "user" u LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id WHERE u.role='farmer' AND u.id>${after} ORDER BY u.id LIMIT 100`;
  if(!batch.length)break;
  async function processOne(farmer){
   try{
    const result=apply?await processFarmer(farmer.id,false,catalogue):await planFarmerAssignment(farmer,farmer.assignment_source,catalogue,fpos);
    totals.processed++;totals[result.assignment_status]++;
    if(result.district){const key=result.district.state+' / '+result.district.district;const item=districts.get(key)||{district:key,status:result.assignment_status,farmers:0};item.farmers++;districts.set(key,item);}
    if(result.reason)reasons.set(result.reason,(reasons.get(result.reason)||0)+1);
   }catch(e){totals.errors++;console.error('A farmer could not be processed:',e.code||e.name);}
  }
  for(let offset=0;offset<batch.length;offset+=8) await Promise.all(batch.slice(offset,offset+8).map(processOne));
  after=batch[batch.length-1].id;
  if(totals.processed%500===0)console.log('Processed:',totals.processed);
 }
 console.log(JSON.stringify({mode:apply?'applied':'preview',totals,districts:[...districts.values()].sort((a,b)=>b.farmers-a.farmers),pending_reasons:Object.fromEntries(reasons)},null,2));
 if(totals.errors)process.exitCode=1;
})().catch(e=>{console.error('Backfill failed:',e.code||e.name);process.exitCode=1;}).finally(()=>sql.end());
