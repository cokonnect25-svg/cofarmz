// Read-only schema inspection; never prints connection credentials or user data.
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());
const sql = require('postgres')(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, connect_timeout: 10, max: 1 });
(async () => {
  console.log(JSON.stringify(await sql`SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`));
  console.log(JSON.stringify(await sql`SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace`));
})().catch(e => { console.error(e.code || e.name); process.exitCode = 1; }).finally(() => sql.end());
