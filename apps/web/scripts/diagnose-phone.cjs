// Read-only lookup using the same comparisons as the verification endpoint.
require('@next/env').loadEnvConfig(process.cwd());
const digits = String(process.argv[2] || '').replace(/\D/g, '');
if (!digits) throw new Error('Pass the phone number including its country code');
const legacy = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : '';
const sql = require('postgres')(process.env.DATABASE_URL, { max: 1, connect_timeout: 10 });
(async () => {
  await sql.begin(async tx => {
    await tx`SET TRANSACTION READ ONLY`;
    const matches = await tx`
      SELECT id, phone, phone_verified, role,
        CASE WHEN position('@' in email) > 0
          THEN left(email, 2) || '***@' || split_part(email, '@', 2)
          ELSE NULL END AS masked_email
      FROM "user"
      WHERE phone IS NOT NULL AND phone <> ''
        AND (regexp_replace(phone, '[^0-9]', '', 'g') = ${digits}
          OR (${legacy} <> '' AND regexp_replace(phone, '[^0-9]', '', 'g') = ${legacy}))
    `;
    console.log(JSON.stringify({ matching_accounts: matches.length, matches }, null, 2));
  });
})().catch(error => {
  console.error('Read-only phone diagnostic failed:', error.code || error.name);
  process.exitCode = 1;
}).finally(() => sql.end());
