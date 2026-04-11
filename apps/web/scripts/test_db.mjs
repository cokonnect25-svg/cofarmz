import postgres from 'postgres';
import pg from 'pg';
const { Pool } = pg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("❌ DATABASE_URL not found in .env");
  process.exit(1);
}

console.log(`🔍 Testing connection to: ${dbUrl.split('@')[1]}`);

async function testPostgresJS() {
  console.log("\n--- Testing 'postgres' driver (used in sql.ts) ---");
  const sql = postgres(dbUrl, {
    ssl: { rejectUnauthorized: false }, // Force same SSL settings as Better Auth
    connect_timeout: 10,
  });

  try {
    const result = await sql`SELECT NOW() as time, current_database() as db`;
    console.log("✅ postgres.js connect successful!");
    console.log(`🕒 DB Time: ${result[0].time}`);
    console.log(`📁 Database: ${result[0].db}`);
    
    // Check if user table exists
    const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
    console.log(`📊 Found ${tables.length} tables in public schema.`);
    if (tables.some(t => t.table_name === 'user')) {
      console.log("✅ 'user' table exists.");
    } else {
      console.warn("⚠️ 'user' table NOT FOUND! Did you run the schema script?");
    }
  } catch (err) {
    console.error("❌ postgres.js error:", err.message);
  } finally {
    await sql.end();
  }
}

async function testPgPool() {
  console.log("\n--- Testing 'pg' (Pool) driver (used in Better Auth) ---");
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as time');
    console.log("✅ pg.Pool connect successful!");
    console.log(`🕒 DB Time: ${result.rows[0].time}`);
    client.release();
  } catch (err) {
    console.error("❌ pg.Pool error:", err.message);
  } finally {
    await pool.end();
  }
}

async function runTests() {
  await testPostgresJS();
  await testPgPool();
}

runTests();
