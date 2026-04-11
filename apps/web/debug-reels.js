const postgres = require('postgres');
const DATABASE_URL = 'postgresql://postgres:Cokonnect%402026@34.14.133.46:5432/postgres?sslmode=no-verify';
const sql = postgres(DATABASE_URL, {
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    const columns = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'reels'`;
    console.log('Columns in reels table:', columns.map(c => c.column_name));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

check();
