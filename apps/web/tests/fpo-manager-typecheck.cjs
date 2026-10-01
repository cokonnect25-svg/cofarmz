const ts = require('typescript');
const cfg = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, '.');
const files = ['app/api/admin/fpo/credentials/route.ts', 'app/api/fpo/manager/route.ts', 'components/FpoCredentials.tsx', 'app/fpo/login/page.tsx', 'app/fpo/dashboard/page.tsx'];
const program = ts.createProgram(files, {...parsed.options, incremental: false});
const errors = ts.getPreEmitDiagnostics(program);
console.log(errors.length ? ts.formatDiagnosticsWithColorAndContext(errors, {getCanonicalFileName: f=>f, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: ()=> '\n'}) : 'PASS: FPO manager files and dependencies type check');
process.exitCode = errors.length ? 1 : 0;
