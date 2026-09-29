const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const data = new Map();
global.window = {};
global.localStorage = { getItem: k => data.get(k) || null, setItem: (k,v) => data.set(k,v), removeItem: k => data.delete(k) };
function load(file, mocks={}) {
  const m=new Module(file,module);
  m.require=n=>n in mocks?mocks[n]:require(n);
  m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
  return m.exports;
}
const cache=load('lib/fpo-cache.ts');
const credential=load('lib/mobile-credential.ts');
const auth=load('hooks/useAuth.ts',{
  '@/lib/auth-client': {}, 'next/navigation': {}, '@/lib/api': {}, '@capacitor/core': {},
  '@/lib/mobile-credential': credential, '@/lib/fpo-cache': cache,
});
auth.storeMobileSession({id:'a'},'signed-token');
cache.writeFpoCache('a',{district:'District A',assignment_status:'assigned'});
assert.equal(cache.readFpoCache('a').mine.district,'District A');
assert.equal(cache.readFpoCache('b'),null);
// New module instance simulates JS restarting with persisted storage.
assert.equal(load('lib/fpo-cache.ts').readFpoCache('a').mine.district,'District A');
assert.equal(load('lib/mobile-credential.ts').getMobileCredential(),'signed-token');
auth.storeMobileSession({id:'a',image:'new-photo'});
assert.equal(credential.getMobileCredential(),'signed-token');
cache.writeFpoCache('a',null);
assert.equal(cache.readFpoCache('a').mine,null);
auth.storeMobileSession({id:'b'});
assert.equal(credential.getMobileCredential(),null);
assert.equal(cache.readFpoCache('a'),null);
cache.writeFpoCache('b',{district:'B'});
auth.clearMobileSession();
assert.equal(cache.readFpoCache('b'),null);
cache.writeFpoCache('a',{});
const key=[...data.keys()].find(k=>k.includes('fpo_profile_cache'));
data.set(key,JSON.stringify({userId:'a',mine:{},savedAt:Date.now()-8*86400000}));
assert.equal(cache.readFpoCache('a'),null);
data.set(key,'invalid');
assert.equal(cache.readFpoCache('a'),null);
console.log('PASS: FPO cache survives restart, isolates accounts, replaces assignments, expires, clears on logout; profile updates preserve credentials');
