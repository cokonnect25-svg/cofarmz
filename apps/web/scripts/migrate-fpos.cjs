const fs = require('node:fs');
const path = require('node:path');
require('@next/env').loadEnvConfig(process.cwd());
const sql = require('postgres')(process.env.DATABASE_URL, {ssl:{rejectUnauthorized:false},max:1});
(async () => {
  if (!process.argv.includes('--apply')) throw new Error('Review migration first, then run with --apply');
  const migration = fs.readFileSync(path.join(__dirname,'../migrations/20260923_digital_fpos.sql'),'utf8');
  await sql.unsafe(migration);
  await sql.unsafe(fs.readFileSync(path.join(__dirname,'../migrations/20260923_fpo_admin_review.sql'),'utf8'));
  const catalogue = JSON.parse(fs.readFileSync(path.join(__dirname,'../data/fpo-districts.json'),'utf8'));
  await sql.begin(async tx => {
    for (const d of catalogue.districts) {
      if (!d.state || !d.district || !d.source) throw new Error('Invalid district catalogue');
      await tx`INSERT INTO fpo_districts(state,district,source) VALUES(${d.state},${d.district},${d.source}) ON CONFLICT DO NOTHING`;
    }
  });
  console.log('Digital FPO schema and district catalogue ready. No farmers reassigned.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>sql.end());
