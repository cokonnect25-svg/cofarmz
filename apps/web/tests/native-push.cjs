const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
let effect, cleanup, native = true, permission = 'granted', responseOk = true;
let registered = 0, removed = 0, sent, errors = [];
const handlers = {};
const tick = () => new Promise(resolve => setImmediate(resolve));
const mod = new Module('native-push-test', module);
mod.require = name => {
  if (name === 'react') return { useEffect: fn => { effect = fn; } };
  if (name === 'next/navigation') return { useRouter: () => ({ push() {} }) };
  if (name === '@capacitor/core') return { Capacitor: { isNativePlatform: () => native, getPlatform: () => 'android' } };
  if (name === '@/lib/fpo-fetch') return { fpoFetch: async (path, options) => {
    sent = { path, options }; return { ok: responseOk, status: responseOk ? 200 : 401 };
  } };
  if (name === '@capacitor/push-notifications') return { PushNotifications: {
    requestPermissions: async () => ({ receive: permission }),
    createChannel: async channel => assert.equal(channel.id, 'default'),
    addListener: async (event, handler) => {
      handlers[event] = handler;
      return { remove: async () => { removed++; } };
    },
    register: async () => { registered++; },
  } };
  return require(name);
};
mod._compile(ts.transpileModule(fs.readFileSync('app/components/NativePushNotifications.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, 'native-push-test');
const originalError = console.error;
console.error = (...args) => errors.push(args);
(async () => {
  mod.exports.default({ userId: 'mobile-user' }); cleanup = effect(); await tick();
  assert.equal(registered, 1);
  await handlers.registration({ value: 'device-token' });
  assert.equal(sent.path, '/api/push-tokens');
  assert.equal(sent.options.headers['x-user-id'], undefined);
  assert.deepEqual(JSON.parse(sent.options.body), { userId: 'mobile-user', token: 'device-token', platform: 'android' });
  responseOk = false;
  await handlers.registration({ value: 'device-token' });
  assert.equal(errors.length, 1);
  assert.match(errors[0][1].message, /401/);
  cleanup(); assert.equal(removed, 3);
  // Remounting the same user must register again, rather than retain stale listeners.
  mod.exports.default({ userId: 'mobile-user' }); cleanup = effect(); await tick();
  assert.equal(registered, 2); cleanup();
  permission = 'denied';
  mod.exports.default({ userId: 'mobile-user' }); cleanup = effect(); await tick();
  assert.equal(registered, 2); cleanup();
  native = false;
  mod.exports.default({ userId: 'mobile-user' }); assert.equal(effect(), undefined);
  console.log('PASS: native push registration, rejected API responses, listener cleanup, remount, denied permissions, web exclusion');
})().catch(error => { originalError(error); process.exitCode = 1; }).finally(() => { console.error = originalError; });
