const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const projectId = 'phone-test';
process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId;
function token(phone) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ aud: projectId, iss: `https://securetoken.google.com/${projectId}`, sub: 'firebase-user', exp: Math.floor(Date.now() / 1000) + 300, auth_time: Math.floor(Date.now() / 1000), phone_number: phone })).toString('base64url');
  const body = `${header}.${payload}`;
  return `${body}.${crypto.sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64url')}`;
}
const filename = path.resolve(__dirname, '../app/api/users/verify-phone/route.ts');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
let duplicate = false;
let duplicateChecks = 0;
let writes = 0;
let lookupValues;
const sql = async (parts, ...values) => {
  const query = parts.join('?');
  if (query.includes('ALTER TABLE')) return [];
  if (query.includes('SELECT id, role')) return [{ id: 'current', role: 'farmer', role_id: 1 }];
  if (query.includes('id <>')) {
    duplicateChecks++;
    lookupValues = values;
    return duplicate ? [{ id: 'other-account' }] : [];
  }
  if (query.includes('UPDATE')) {
    writes++;
    return [{ id: 'current', phone: values[0], phone_verified: true }];
  }
  throw new Error('Unexpected query');
};
global.fetch = async () => ({ ok: true, json: async () => ({ test: publicKey.export({ type: 'spki', format: 'pem' }) }) });
const compiled = new Module(filename, module);
compiled.require = name => {
  if (name === '@/app/api/utils/sql') return sql;
  if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ body, status: options?.status || 200 }) } };
  return require(name);
};
compiled._compile(source, filename);
const post = (phone, expectedPhone) => compiled.exports.POST({ json: async () => ({ userId: 'current', idToken: token(phone), ...(expectedPhone === undefined ? {} : { expectedPhone }) }) });

(async () => {
  const entered = '+917550391602';
  let response = await post('+919999999999', entered);
  assert.equal(response.body.code, 'PHONE_TOKEN_MISMATCH');
  assert.equal(duplicateChecks, 0);
  assert.equal(writes, 0);
  response = await post(entered, entered);
  assert.equal(response.status, 200, 'No matching record allows verification');
  assert.equal(response.body.phone, entered);
  assert.equal(writes, 1);
  assert(lookupValues.includes('917550391602'));
  assert(lookupValues.includes('7550391602'));
  duplicate = true;
  const warn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  try { response = await post(entered, entered); }
  finally { console.warn = warn; }
  assert.equal(response.status, 409);
  assert.equal(response.body.code, 'PHONE_ALREADY_LINKED');
  assert(response.body.diagnosticId);
  assert.equal(warnings[0][1].conflictingUserId, 'other-account');
  assert(!JSON.stringify(response.body).includes('other-account'));
  assert.equal(writes, 1, 'Conflicts must not write');
  duplicate = false;
  assert.equal((await post(entered)).status, 200, 'Existing Android clients remain compatible');
  console.log('Phone route checks passed: token mismatch, no conflict, actual conflict, and older clients.');
})().catch(error => { console.error(error); process.exitCode = 1; });
