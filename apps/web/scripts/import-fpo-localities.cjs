// Offline preview by default. Apply replaces only this source's place directory,
// never farmer profiles, FPOs, or memberships.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const zlib=require('node:zlib');
const readline=require('node:readline');
const root=path.resolve(__dirname,'..');
const normalize=value=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const parentKey=(state,district)=>JSON.stringify([state,district]);

async function* records(file) {
  const input=fs.createReadStream(file).pipe(zlib.createGunzip());
  const lines=readline.createInterface({input,crlfDelay:Infinity});
  // Propagate stream errors rather than hanging or silently accepting a prefix.
  let failure;
  input.on('error',error=>{failure=error;lines.close();});
  try {
    for await(const line of lines) {
      const record=JSON.parse(line);
      if(!Array.isArray(record)||record.length!==5||record.some(v=>typeof v!=='string'||!v.trim())||
        !['subdistrict','village','town'].includes(record[2])||!/^\d+$/.test(record[3])||!normalize(record[4]))
        throw new Error('Invalid locality record');
      yield record;
    }
    if(failure)throw failure;
  } finally {lines.close();input.destroy();}
}

async function inspectSnapshot() {
  const file=path.join(root,'data/fpo-localities.jsonl.gz');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/fpo-localities-manifest.json'),'utf8'));
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==manifest.sha256)
    throw new Error('Locality snapshot checksum does not match its manifest');
  const catalogue=JSON.parse(fs.readFileSync(path.join(root,'data/fpo-districts.json'),'utf8')).districts;
  const known=new Set(catalogue.map(d=>parentKey(d.state,d.district)));
  const states={},kinds={},districts=new Set();let count=0;
  for await(const [state,district,kind] of records(file)) {
    if(!known.has(parentKey(state,district)))throw new Error('Snapshot has an unknown parent district');
    count++;states[state]=(states[state]||0)+1;kinds[kind]=(kinds[kind]||0)+1;districts.add(parentKey(state,district));
  }
  if(count!==manifest.records||districts.size!==manifest.districts||
    JSON.stringify(Object.entries(states).sort())!==JSON.stringify(Object.entries(manifest.states).sort())||
    JSON.stringify(Object.entries(kinds).sort())!==JSON.stringify(Object.entries(manifest.kinds).sort())||
    new Set(catalogue.map(d=>d.state)).size!==Object.keys(states).length)
    throw new Error('Locality snapshot coverage does not match its manifest/catalogue');
  return {file,manifest};
}

async function importSnapshot(sql,snapshot) {
  const {file,manifest}=snapshot;
  return sql.begin(async tx=>{
    await tx`SELECT pg_advisory_xact_lock(hashtext('cofarmz-fpo-locality-import'))`;
    const catalogue=await tx`SELECT id,state,district FROM fpo_districts`;
    const parents=new Map(catalogue.map(d=>[parentKey(d.state,d.district),d.id]));
    await tx`DELETE FROM fpo_localities WHERE source LIKE 'lgd:%'`;
    let batch=[],inserted=0;
    async function flush() {
      if(!batch.length)return;
      const result=await tx`INSERT INTO fpo_localities ${tx(batch,'district_id','kind','code','name','name_key','source')}
        ON CONFLICT DO NOTHING`;
      inserted+=result.count;batch=[];
    }
    for await(const [state,district,kind,code,name] of records(file)) {
      const district_id=parents.get(parentKey(state,district));
      if(!district_id)throw new Error('Database parent district missing; run migrate:fpo first');
      batch.push({district_id,kind,code,name,name_key:normalize(name),source:'lgd:'+manifest.snapshot_date});
      if(batch.length===2000)await flush();
    }
    await flush();
    return {inserted,snapshot_date:manifest.snapshot_date,states:Object.keys(manifest.states).length};
  });
}

module.exports={inspectSnapshot,importSnapshot,records,normalize};
if(require.main===module)(async()=>{
  const snapshot=await inspectSnapshot();
  console.log(JSON.stringify({mode:process.argv.includes('--apply')?'apply':'preview',
    ...snapshot.manifest},null,2));
  if(!process.argv.includes('--apply'))return;
  require('@next/env').loadEnvConfig(root);
  const sql=require('postgres')(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:1,connect_timeout:10});
  try {console.log(JSON.stringify(await importSnapshot(sql,snapshot)));}
  finally {await sql.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
