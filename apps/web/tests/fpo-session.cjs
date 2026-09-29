const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { createHmac } = require('node:crypto');
process.env.BETTER_AUTH_SECRET = 'test-secret';
let rows = [{ id: 'farmer', role: 'farmer' }], calls = 0;
function load(file, mocks) {
  const mod = new Module(file, module);
  mod.require = name => name in mocks ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
  return mod.exports;
}
const sql = async (parts, ...values) => {
  calls++;
  assert(parts.join('?').includes('s."expiresAt" > NOW()'));
  assert.deepEqual(values, ['valid-token']);
  return rows;
};
const { getSignedCookieUser } = load('lib/session-user.ts', { '@/app/api/utils/sql': { default: sql } });
const signed = encodeURIComponent('valid-token.' + createHmac('sha256', process.env.BETTER_AUTH_SECRET).update('valid-token').digest('base64'));
const headers = cookie => new Headers({ cookie });
(async () => {
  for (const name of ['cofarmz.session_token', '__Secure-cofarmz.session_token', '__Host-cofarmz.session_token', 'better-auth.session_token', '__Secure-better-auth.session_token', '__Host-better-auth.session_token']) {
    assert.equal((await getSignedCookieUser(headers(`${name}=${signed}`))).id, 'farmer');
  }
  const before = calls;
  for (const value of ['valid-token', '%ZZ', signed + 'tampered']) assert.equal(await getSignedCookieUser(headers(`cofarmz.session_token=${value}`)), null);
  assert.equal(calls, before);
  assert.equal((await getSignedCookieUser(new Headers({ authorization: `Bearer ${signed}` }))).id, 'farmer');
  assert.equal(await getSignedCookieUser(new Headers({ authorization: `Bearer ${signed}tampered` })), null);
  assert.equal(await getSignedCookieUser(new Headers({ 'x-user-id': 'farmer' })), null);
  rows = []; // Expired/revoked sessions are filtered by the database.
  assert.equal(await getSignedCookieUser(headers(`cofarmz.session_token=${signed}`)), null);
  assert.equal(await getSignedCookieUser(new Headers({ authorization: `Bearer ${signed}` })), null);
  let session = null;
  rows = [{ id: 'farmer', role: 'farmer' }];
  const { requireActor } = load('lib/fpo-access.ts', {
    '@/lib/auth': { auth: { api: { getSession: async () => session } } },
    '@/lib/session-user': { getSignedCookieUser },
    '@/app/api/utils/sql': { default: async () => rows },
    './fpo-error': load('lib/fpo-error.ts', {}),
    'next/server': {},
  });
  const request = cookie => new Request('http://localhost/api/digital-fpos', { headers: headers(cookie) });
  assert.equal((await requireActor(request(`cofarmz.session_token=${signed}`))).id, 'farmer');
  assert.equal((await requireActor(new Request('http://localhost/api/digital-fpos', { headers: { authorization: `Bearer ${signed}` } }))).id, 'farmer');
  await assert.rejects(requireActor(request(`cofarmz.session_token=${signed}`), true), e => e.status === 403);
  await assert.rejects(requireActor(request('')), e => e.status === 401);
  session = { user: { id: 'farmer' } };
  assert.equal((await requireActor(request(''))).id, 'farmer');
  console.log('PASS: signed legacy/mobile cookies, invalid signatures, expiry query, FPO authentication and admin boundary');
})().catch(e => { console.error(e); process.exitCode = 1; });
