// Dedicated process: npm run auto:fpo. Scheduled one-shot job: npm run auto:fpo:once.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const interval = Number(process.env.FPO_ASSIGNMENT_INTERVAL_SECONDS || 900);
if (!Number.isFinite(interval) || interval < 60 || interval > 86400) throw new Error('FPO_ASSIGNMENT_INTERVAL_SECONDS must be between 60 and 86400');
const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(new URL(process.env.DATABASE_URL).hostname);
const sql = require('postgres')(process.env.DATABASE_URL, {
  ssl: local ? false : { rejectUnauthorized: false }, max: 4, connect_timeout: 10,
  connection: { statement_timeout: 30000, lock_timeout: 10000 },
});
const modules = new Map();
function load(name) {
  const key = path.basename(name).replace(/\.ts$/, '');
  if (!['fpo-automation', 'fpo-assignment', 'fpo-location', 'fpo-error'].includes(key)) throw new Error('Unsupported module');
  if (modules.has(key)) return modules.get(key).exports;
  const mod = { exports: {} }; modules.set(key, mod);
  const source = fs.readFileSync(path.join(__dirname, '../lib', key + '.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', compiled)(id => id === '@/app/api/utils/sql' ? { __esModule: true, default: sql } : load(id), mod, mod.exports);
  return mod.exports;
}
let stopping = false;
let wake;
function stop() { stopping = true; console.log('Stopping after the current farmer finishes. Completed assignments are saved.'); if (wake) wake(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
(async () => {
  const { reconcileFpoAssignments } = load('fpo-automation');
  do {
    const started = Date.now();
    let stage = 'Starting assignment sweep';
    const progress = message => { stage = message; console.log(`[${Math.round((Date.now() - started) / 1000)}s] ${message}`); };
    progress(stage);
    const heartbeat = setInterval(() => console.log(`[${Math.round((Date.now() - started) / 1000)}s] Still running: ${stage}`), 10000);
    try {
      const result = await reconcileFpoAssignments(() => stopping, progress);
      console.log(JSON.stringify({ at: new Date().toISOString(), ...result }));
      if (process.argv.includes('--once') && result.errors) process.exitCode = 1;
    } catch (error) {
      console.error('Automatic FPO assignment failed:', error.code || error.name);
      if (error.code === 'FPO_SETUP_REQUIRED') console.error('Run npm run migrate:fpo -- --apply, then npm run import:fpo-localities -- --apply before retrying.');
      if (process.argv.includes('--once')) process.exitCode = 1;
    } finally { clearInterval(heartbeat); }
    if (stopping || process.argv.includes('--once')) break;
    await new Promise(resolve => {
      const timer = setTimeout(() => { wake = null; resolve(); }, interval * 1000);
      wake = () => { clearTimeout(timer); wake = null; resolve(); };
    });
  } while (!stopping);
})().catch(error => { console.error('Worker failed:', error.code || error.name); process.exitCode = 1; }).finally(() => sql.end({ timeout: 5 }));
