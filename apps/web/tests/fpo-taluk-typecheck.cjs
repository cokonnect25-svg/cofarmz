const ts = require('typescript');
const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const files = ['components/FpoHierarchy.tsx','app/api/digital-fpos/[id]/hierarchy/route.ts','next-env.d.ts','app/select-role/page.tsx','app/signup/page.tsx','lib/fpo-report.ts','components/FpoPdfExport.tsx','lib/fpo-taluk.ts','lib/fpo-assignment.ts','lib/fpo-provision.ts','lib/fpo-automation.ts','app/api/digital-fpos/route.ts','app/api/digital-fpos/[id]/route.ts','app/api/admin/fpo/route.ts','app/api/fpo-taluks/route.ts','app/api/users/profile/route.ts','app/digital-fpos/page.tsx','components/TalukSelect.tsx','components/FarmerFpo.tsx','components/MyDigitalFpo.tsx','components/FpoBackfill.tsx','app/api/admin/fpo/credentials/route.ts', 'app/api/fpo/manager/route.ts', 'components/FpoCredentials.tsx', 'app/fpo/login/page.tsx', 'app/fpo/dashboard/page.tsx'];
if (process.argv.includes('--profile')) files.push('app/user-profile/page.tsx');
const program = ts.createProgram(files, {...parsed.options, incremental: false});
const errors = ts.getPreEmitDiagnostics(program);
console.log(errors.length ? ts.formatDiagnosticsWithColorAndContext(errors, {getCanonicalFileName: f=>f, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: ()=> '\n'}) : 'PASS: FPO taluk files and dependencies type check');
process.exitCode = errors.length ? 1 : 0;
