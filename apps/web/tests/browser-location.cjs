const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../lib/browser-location.ts');
const compiled = new Module(file, module);
compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, file);
const { getBrowserPosition, getLocationErrorMessage } = compiled.exports;
const position = { coords: { latitude: 12.9, longitude: 77.6 } };

async function scenario(outcomes, secure = true, supported = true) {
  const calls = [];
  global.window = { isSecureContext: secure };
  Object.defineProperty(global, 'navigator', { configurable: true, value: {
    geolocation: supported ? { getCurrentPosition(resolve, reject, options) {
      calls.push(options);
      const result = outcomes.shift();
      if (result.code) reject(result); else resolve(result);
    } } : undefined,
  } });
  const promise = getBrowserPosition();
  return { promise, calls };
}

(async () => {
  let run = await scenario([position]);
  assert.equal(await run.promise, position);
  assert.equal(run.calls[0].enableHighAccuracy, false);
  assert(run.calls[0].timeout > 10000);
  for (const code of [2, 3]) {
    run = await scenario([{ code }, position]);
    assert.equal(await run.promise, position);
    assert.equal(run.calls.length, 2);
    assert.equal(run.calls[1].enableHighAccuracy, true);
  }
  run = await scenario([{ code: 1 }]);
  await assert.rejects(run.promise, error => error.code === 1);
  assert.equal(run.calls.length, 1, 'Do not retry denied permissions');
  run = await scenario([{ code: 3 }, { code: 2 }]);
  await assert.rejects(run.promise, error => error.code === 2);
  run = await scenario([], false);
  await assert.rejects(run.promise, /HTTPS/);
  assert.equal(run.calls.length, 0);
  run = await scenario([], true, false);
  await assert.rejects(run.promise, /map/);
  assert(getLocationErrorMessage({ code: 1 }).includes('laptop settings'));
  assert(getLocationErrorMessage({ code: 3 }).includes('timed out'));
  assert.equal(getLocationErrorMessage(new Error('Unable to save location')), 'Unable to save location');
  console.log('Browser location checks passed: success, fallback, permission denial, timeout, and unsupported contexts.');
})().catch(error => { console.error(error); process.exitCode = 1; });
