const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
const file = path.resolve(__dirname, '../lib/fpo-report.ts');
const compiled = new Module(file, module);
compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { loadFpoReport, renderFpoReport } = compiled.exports;
const fpos = [
  { id: '1', group_id: 'group-a', name: 'District A FPO', state: 'State A', district: 'District A', status: 'active' },
  { id: '2', group_id: 'group-b', name: 'District B FPO', state: 'State B', district: 'District B', status: 'inactive' },
];
const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: String(i), name: `Farmer ${i}`, group_id: 'group-a', assignment_status: 'assigned' }));
const last = { id: 'last', name: '<script>alert("x")</script> రైతు किसान', group_id: 'group-a', assignment_status: 'assigned' };

(async () => {
  const calls = [];
  const read = async url => {
    calls.push(url);
    if (url === '/api/digital-fpos') return { can_review: true, fpos };
    const params = new URL(url, 'http://localhost').searchParams;
    return params.get('after') ? { farmers: [last, { ...last, id: 'pending', group_id: null }], next: null } : { farmers: firstPage, next: 'cursor & 100' };
  };
  const overall = await loadFpoReport(read);
  assert.equal(overall.farmers.length, 101);
  assert.equal(overall.fpos.length, 2);
  assert.equal(new URL(calls[2], 'http://localhost').searchParams.get('after'), 'cursor & 100');
  const district = await loadFpoReport(read, 'group-a');
  assert.equal(district.fpos.length, 1);
  assert.equal(district.farmers.length, 101);
  assert(calls.filter(url => url.startsWith('/api/admin/fpo?')).every(url => new URL(url, 'http://localhost').searchParams.get('details') === 'true'));
  assert(calls.slice(-2).every(url => new URL(url, 'http://localhost').searchParams.get('group') === 'group-a'));
  await assert.rejects(loadFpoReport(async () => ({ can_review: false })), /Admin access required/);
  await assert.rejects(loadFpoReport(read, 'missing'), /no longer available/);
  await assert.rejects(loadFpoReport(async url => url === '/api/digital-fpos' ? { can_review: true, fpos } : { farmers: [], next: 'repeated' }), /complete farmer list/);
  await assert.rejects(loadFpoReport(async url => { if (url === '/api/digital-fpos') return { can_review: true, fpos }; throw new Error('Session expired'); }), /Session expired/);
  const html = renderFpoReport(overall.fpos, overall.farmers, false);
  assert(html.includes('101 tagged farmers'));
  assert(html.includes('No assigned farmers.'));
  assert(html.includes('inactive'));
  assert(html.includes('&lt;script&gt;'));
  assert(!html.includes('<script>'));
  assert(html.includes('రైతు किसान'));
  assert(renderFpoReport([], [], false).includes('No Digital FPOs available.'));
  const detailed = renderFpoReport([fpos[0]], [{ ...last,
    location: 'Village <North>\nMain road', district: 'District A', state: 'State A', latitude: 0, longitude: 78.5,
    assignment_source: 'admin_manual', reason: 'Saved district',
    profile_details: { email: 'farmer@example.com', phone: '+91 9876543210', age: 42, gender: 'female',
      bio: '<img src=x onerror=alert(1)>', email_verified: 'true', phone_verified: false,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-09-26T00:00:00Z' },
  }], true);
  for (const value of ['farmer@example.com', '+91 9876543210', '42', 'female', 'Village &lt;North&gt;', 'admin manual', 'Saved district', '<dd>0</dd>', '<dd>No</dd>', '<dd>Yes</dd>', '&lt;img']) assert(detailed.includes(value), value);
  assert(!detailed.includes('<img'));
  assert(html.includes('Not provided'));
  if (process.argv.includes('--preview')) {
    const dir = path.resolve(__dirname, '../tmp/pdfs');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'fpo-report-preview.html'), html);
  }
  console.log('PASS: pagination, district scope, reviewer access, missing district, repeated cursors, failed requests, empty FPOs, HTML escaping and local-language names');
})().catch(error => { console.error(error); process.exitCode = 1; });
