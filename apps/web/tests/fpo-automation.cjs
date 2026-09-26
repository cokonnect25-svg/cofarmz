const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name, dependencies) {
  const source = fs.readFileSync(path.join(__dirname, '../lib', name + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => {
    if (!(name in dependencies)) throw new Error('Unexpected dependency ' + name);
    return dependencies[name];
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  let acquired = true, released = 0, unlocked = 0, queried = 0;
  let batches = [[{ id: 'a' }, { id: 'b' }], [{ id: 'c' }], []];
  const processed = [], cursors = [];
  const connection = async strings => strings.join('').includes('try_advisory') ? [{ acquired }] : (unlocked++, []);
  connection.release = () => released++;
  const db = async (strings, ...values) => {
    if (strings.join('').includes('FROM fpo_districts')) return [{ id: 'district' }];
    queried++; cursors.push(values[0]); return batches.shift();
  };
  db.reserve = async () => connection;
  const { reconcileFpoAssignments } = load('fpo-automation', {
    '@/app/api/utils/sql': { __esModule: true, default: db },
    './fpo-assignment': { processFarmer: async (id, dryRun) => {
      assert.equal(dryRun, false); processed.push(id);
      if (id === 'b') throw new Error('Concurrent edit');
      return { assignment_status: id === 'a' ? 'assigned' : 'pending_location' };
    } },
  });
  const result = await reconcileFpoAssignments();
  assert.deepEqual(processed, ['a', 'b', 'c']);
  assert.deepEqual(cursors, ['', 'b', 'c']);
  assert.equal(result.assigned, 1); assert.equal(result.pending_location, 1); assert.equal(result.errors, 1);
  assert.equal(unlocked, 1); assert.equal(released, 1);
  acquired = false;
  assert.equal((await reconcileFpoAssignments()).skipped, true);
  assert.equal(queried, 3); assert.equal(unlocked, 1); assert.equal(released, 2);
  acquired = true;
  await reconcileFpoAssignments(() => true);
  assert.equal(queried, 3); assert.equal(unlocked, 2); assert.equal(released, 3);
  let resolved = 0;
  const { prepareLocation } = load('fpo-assignment', {
    '@/app/api/utils/sql': {}, './fpo-error': { FpoError: Error },
    './fpo-location': {
      validCoordinates: () => true,
      validateDistrict: async () => ({ id: 'selected' }),
      resolveLegacyLocation: async profile => { resolved++; return { district: { id: 'matched' }, address: profile.location }; },
    },
  });
  assert.equal((await prepareLocation({ location: 'Omalur, Tamil Nadu' }, { location: 'Omalur, Tamil Nadu' })).district.id, 'matched');
  assert.equal(await prepareLocation({ location: 'Elsewhere' }, { district_id: 'manual' }), null);
  assert.equal(await prepareLocation({ latitude: 12, longitude: 78 }, {}), null);
  assert.equal(resolved, 1);
  console.log('PASS: automatic batches, failure isolation, overlap lock, graceful stop, unchanged-address retry, saved district and GPS protections');
})().catch(error => { console.error(error); process.exitCode = 1; });
