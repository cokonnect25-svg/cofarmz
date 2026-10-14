const ts=require('typescript');
const cfg=ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(cfg.config,ts.sys,'.');
const program=ts.createProgram(['app/user-profile/page.tsx','app/farmer-profile/page.tsx','app/api/farmer-crops/route.ts','app/api/farmers/profile/route.ts','next-env.d.ts'],{...parsed.options,incremental:false});
const errors=ts.getPreEmitDiagnostics(program);
console.log(errors.length?ts.formatDiagnosticsWithColorAndContext(errors,{getCanonicalFileName:f=>f,getCurrentDirectory:ts.sys.getCurrentDirectory,getNewLine:()=> '\n'}):'PASS: crop profile forms, public profile and API type check');
process.exitCode=errors.length?1:0;
