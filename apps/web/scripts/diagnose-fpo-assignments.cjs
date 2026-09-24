// Aggregate-only diagnostics. Does not expose farmer profiles or database credentials.
require('@next/env').loadEnvConfig(process.cwd());
const sql=require('postgres')(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:false},max:1,connect_timeout:10});
(async()=>{
 console.log('Configured address geocoder:',Boolean(process.env.FPO_GEOCODER_URL));
 await sql.begin(async tx=>{
  await tx`SET TRANSACTION READ ONLY`;
  const tables=await tx`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('fpo_districts','digital_fpos','farmer_fpo_assignments')`;
  console.log('FPO tables:',tables.map(x=>x.table_name).join(', '));
  if(tables.length!==3)return;
  console.log('District catalogue:',await tx`SELECT count(*)::int AS districts FROM fpo_districts`);
  console.log('FPOs:',await tx`SELECT status,count(*)::int AS count FROM digital_fpos GROUP BY status`);
  console.log('Farmer profile coverage:',await tx`SELECT count(*)::int AS farmers,count(*) FILTER(WHERE district_id IS NOT NULL)::int AS saved_district,count(*) FILTER(WHERE length(trim(coalesce(location,'')))>0)::int AS saved_address FROM "user" WHERE role='farmer'`);
  console.log('Assignment states:',await tx`SELECT coalesce(a.assignment_status,'not_processed') AS status,a.reason,count(*)::int AS count FROM "user" u LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id WHERE u.role='farmer' GROUP BY a.assignment_status,a.reason`);
  console.log('Group eligibility:',await tx`SELECT count(*)::int AS stored_members,count(*) FILTER(WHERE can_receive_fpo_message(a.farmer_id,a.group_id))::int AS eligible_members FROM farmer_fpo_assignments a WHERE a.group_id IS NOT NULL`);
  console.log('District consistency:',await tx`SELECT count(*)::int AS mismatched_members FROM farmer_fpo_assignments a JOIN "user" u ON u.id=a.farmer_id JOIN farmer_groups g ON g.id=a.group_id JOIN digital_fpos f ON f.id=g.digital_fpo_id WHERE a.district_id IS DISTINCT FROM u.district_id OR a.district_id IS DISTINCT FROM f.district_id`);

 });
})().catch(e=>{console.error('Diagnostic failed:',e.code||e.name);process.exitCode=1;}).finally(()=>sql.end());
