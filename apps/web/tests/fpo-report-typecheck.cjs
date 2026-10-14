const ts = require('typescript');
const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const program = ts.createProgram(['app/api/fpo/report/route.ts', 'components/FpoPdfExport.tsx', 'app/fpo/dashboard/page.tsx', 'next-env.d.ts'], {...parsed.options, incremental:false});
const errors = ts.getPreEmitDiagnostics(program);
console.log(errors.length ? ts.formatDiagnosticsWithColorAndContext(errors, {getCanonicalFileName:f=>f, getCurrentDirectory:ts.sys.getCurrentDirectory, getNewLine:()=> '\n'}) : 'PASS: filtered report route and UI type check');
process.exitCode = errors.length ? 1 : 0;
