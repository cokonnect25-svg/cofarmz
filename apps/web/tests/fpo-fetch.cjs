const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
let native = true, failCookie = false, sent, storedToken = null;
global.window = { location: { origin: 'https://backend.example' } };
global.fetch = async (url, options) => { sent = { url, options }; return { ok: true }; };
const mod = new Module('fpo-fetch-test', module);
mod.require = name => {
  if (name === '@capacitor/core') return {
    Capacitor: { isNativePlatform: () => native },
    CapacitorCookies: { getCookies: async ({url}) => {
      assert.equal(url, 'https://backend.example');
      if (failCookie) throw new Error('Unavailable');
      return { 'cofarmz.session_token': 'signed%2Btoken' };
    } },
  };
  if (name === '@/lib/mobile-credential') return { getMobileCredential: () => storedToken };
  if (name === '@/lib/api') return { getApiUrl: path => 'https://backend.example' + path };
  return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync('lib/fpo-fetch.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, 'fpo-fetch-test');
(async () => {
  const { fpoFetch } = mod.exports;
  const controller = new AbortController();
  await fpoFetch('/api/digital-fpos/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: controller.signal });
  assert.equal(sent.options.headers.get('Authorization'), 'Bearer signed%2Btoken');
  assert.equal(sent.options.headers.get('Content-Type'), 'application/json');
  assert.equal(sent.options.body, '{}');
  assert.equal(sent.options.signal, controller.signal);
  assert.equal(sent.options.credentials, 'include');
  native = false;
  await fpoFetch('/api/digital-fpos');
  assert.equal(sent.options.headers.get('Authorization'), null);
  native = true; failCookie = true;
  await fpoFetch('/api/digital-fpos');
  assert.equal(sent.options.credentials, 'include');
  storedToken = 'signed-login-token';
  await fpoFetch('/api/notifications?userId=farmer-a&since=2026-09-30T12%3A00%3A00Z', { cache: 'no-store' });
  assert.equal(sent.options.headers.get('Authorization'), 'Bearer signed-login-token');
  assert.equal(sent.options.credentials, 'include');
  assert.equal(sent.options.cache, 'no-store');
  await fpoFetch('/api/digital-fpos');
  assert.equal(sent.options.headers.get('Authorization'), 'Bearer signed-login-token');
  native = false;
  await fpoFetch('/api/digital-fpos');
  assert.equal(sent.options.headers.get('Authorization'), null);
  await assert.rejects(fpoFetch('https://untrusted.example/api/'), /Expected an API path/);
  console.log('PASS: Android signed credential forwarding, web cookies, plugin fallback, request preservation, external URL rejection');
})().catch(e => { console.error(e); process.exitCode = 1; });
