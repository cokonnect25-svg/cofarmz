const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
let actor = { id: 'farmer-a', role: 'farmer' }, queries = [], rows = [{ id: 'saved' }];
class FpoError extends Error { constructor(message, status = 400) { super(message); this.status = status; } }
const sql = async (strings, ...values) => { queries.push({ query: strings.join('?'), values }); return rows; };
const access = {
  FpoError,
  requireActor: async () => { if (!actor) throw new FpoError('Sign in required',401); return actor; },
  requireFpoReviewer: async () => { if (!actor || !['admin','superadmin','super_admin'].includes(actor.role)) throw new FpoError('Admin access required',403); return actor; },
  fpoError: e => ({ status: e.status || 500, data: { error: e.message } })
};
const compiled = new Module('contact-test', module);
compiled.require = name => name === '@/app/api/utils/sql' ? { default: sql } : name === '@/lib/fpo-access' ? access : name === 'next/server' ? { NextResponse: { json: (data, options = {}) => ({ data, status: options.status || 200, headers: options.headers }) } } : require(name);
compiled._compile(ts.transpileModule(fs.readFileSync('app/api/digital-fpos/contact/route.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, 'contact-test');
const { GET, POST } = compiled.exports;
const id = '12345678-1234-1234-1234-123456789abc';
const post = body => POST(new Request('http://localhost/api/digital-fpos/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
(async () => {
  assert.equal((await post({ fpoId: id, body: ' Hello ', sender_id: 'spoofed' })).status,201);
  assert.deepEqual(queries[0].values, ['farmer-a','Hello',id]);
  assert(queries[0].query.includes("f.status='active'"));
  assert(!queries[0].query.includes('announcements'));
  for (const body of ['', '   ', 'x'.repeat(5001), 123]) assert.equal((await post({ fpoId: id, body })).status,400);
  assert.equal((await post({ fpoId: 'invalid', body: 'Hello' })).status,400);
  assert.equal((await post(null)).status,400);
  rows = [];
  assert.equal((await post({ fpoId: id, body: 'Hello' })).status,404);
  assert.equal((await GET(new Request(`http://localhost/?group=${id}`))).status,403);
  actor = null;
  assert.equal((await post({ fpoId: id, body: 'Hello' })).status,401);
  actor = { id: 'admin-a', role: 'admin' };
  assert.equal((await post({ fpoId: id, body: 'Hello' })).status,403);
  assert.equal((await GET(new Request(`http://localhost/?group=${id}&offset=-1`))).status,400);
  rows = Array.from({length:51},(_,i)=>({id:String(i)}));
  const inbox = await GET(new Request(`http://localhost/?group=${id}`));
  assert.equal(inbox.data.messages.length,50);
  assert.equal(inbox.data.next,50);
  assert.equal(inbox.headers['Cache-Control'],'private, no-store');
  console.log('PASS: private inbox access, sender identity, validation, active target, pagination and no group broadcasting');
})().catch(e => { console.error(e); process.exitCode=1; });
