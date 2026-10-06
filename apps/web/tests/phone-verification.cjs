const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../app/components/PhoneVerificationGate.tsx');
const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;

async function renderScenario(native, response, pathname = '/') {
  const states = [];
  let cursor = 0;
  let initial = true;
  const effects = [];
  const react = {
    useState(value) {
      const index = cursor++;
      if (initial) states[index] = value;
      return [states[index], next => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect(fn) { if (initial) effects.push(fn); },
    useMemo(fn) { return fn(); },
    useRef(value) { return { current: value }; },
  };
  const requests = [];
  global.window = { setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  global.document = { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} };
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (response instanceof Error) throw response;
    return { ok: response.status !== 500, json: async () => response };
  };
  const compiled = new Module(filename, module);
  compiled.require = name => {
    if (name === 'react') return react;
    if (name === '@/lib/api') return { getApiUrl: value => value };
    if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native, getPlatform: () => native ? 'android' : 'web' }, registerPlugin: () => ({}) };
    if (name === '@/lib/phone') return new Proxy({}, { get: (_, key) => key === 'PHONE_COUNTRIES' ? [] : () => key === 'getPhoneCountry' ? { placeholder: '' } : '91' });
    return require(name);
  };
  compiled._compile(source, filename);
  const render = () => { cursor = 0; return compiled.exports.default({ user: { id: 'test-user' }, pathname }); };
  const first = render();
  const cleanups = effects.map(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  initial = false;
  const result = render();
  cleanups.forEach(fn => { if (typeof fn === 'function') fn(); });
  return { first, result, requests };
}

(async () => {
  for (const native of [false, true]) {
    for (const profile of [
      { phone: null, phone_verified: false },
      { phone: '+919876543210', phone_verified: false },
      { phone: null, phone_verified: true },
    ]) {
      const { first, result, requests } = await renderScenario(native, { id: 'test-user', ...profile });
      assert(first, 'Block while the database check is pending');
      assert(JSON.stringify(result).includes('Verify your phone'), 'Require OTP for missing/unverified phones');
      assert.equal(requests[0].options.cache, 'no-store');
      assert.equal(requests[0].options.credentials, 'include');
    }
    for (const response of [new Error('offline'), { status: 500 }, { id: 'wrong-user' }]) {
      const { result } = await renderScenario(native, response);
      assert(JSON.stringify(result).includes('Retry'), 'Failed checks must block with a retry');
    }
    assert.equal((await renderScenario(native, { id: 'test-user', phone: '+919876543210', phone_verified: true })).result, null);
    assert.equal((await renderScenario(native, { id: 'test-user', role: 'superadmin', phone: null, phone_verified: false })).result, null);
    const hidden = await renderScenario(native, {}, '/login');
    assert.equal(hidden.result, null);
    assert.equal(hidden.requests.length, 0);
  }
  console.log('Phone verification regression checks passed for web and Android.');
})().catch(error => { console.error(error); process.exitCode = 1; });
