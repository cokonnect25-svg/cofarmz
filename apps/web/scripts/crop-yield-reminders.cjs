const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const local=['localhost','127.0.0.1','::1','[::1]'].includes(new URL(process.env.DATABASE_URL).hostname);
const sql=require('postgres')(process.env.DATABASE_URL,{ssl:local?false:{rejectUnauthorized:false},max:4,connect_timeout:10});
const modules=new Map();
function load(file){
 if(modules.has(file))return modules.get(file).exports;
 const mod={exports:{}};modules.set(file,mod);
 const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',compiled)(id=>id==='@/app/api/utils/sql'?{__esModule:true,default:sql}:id==='@/app/api/utils/push'?load('app/api/utils/push.ts'):require(id),mod,mod.exports);
 return mod.exports;
}
let stopped=false,wake;
const stop=()=>{stopped=true;if(wake)wake();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
(async()=>{do{
 try{console.log(JSON.stringify({at:new Date().toISOString(),...await load('lib/crop-yield-reminders.ts').sendDailyYieldReminders()}));}
 catch(e){console.error('Yield reminder sweep failed:',e.code||e.name);if(process.argv.includes('--once'))process.exitCode=1;}
 if(stopped||process.argv.includes('--once'))break;
 await new Promise(resolve=>{const timer=setTimeout(resolve,60*60*1000);wake=()=>{clearTimeout(timer);resolve();};});
 }while(!stopped);
})().catch(e=>{console.error(e.name);process.exitCode=1;}).finally(()=>sql.end({timeout:5}));
