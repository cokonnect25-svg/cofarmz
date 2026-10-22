const assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
let delivered=false,success=0,marks=0,pushes=[],released=0;
const sql=async(strings,...values)=>{
 const q=strings.join('?');
 if(q.includes('pg_try_advisory_lock'))return [{acquired:true}];
 if(q.includes('SELECT u.id,u.latitude'))return [
  {id:'farmer',role:'farmer',crop_count:0},
  {id:'buyer',role:'buyer',crop_count:1,latitude:12,longitude:77},
  {id:'supplier',role:'supplier',crop_count:0,equipment_count:0,supplier_types:[]}];
 if(q.includes('SELECT u.id,u.name'))return [{id:'match',name:'Nearby Farmer',crop_name:'Rice'}];
 if(q.includes('SELECT 1 FROM daily_mobile'))return delivered?[]:[{}];
 if(q.includes('UPDATE daily_mobile'))marks++;
 return [];
};
sql.reserve=async()=>Object.assign(sql,{release(){released++;}});
const mod=new Module('reminders',module);
mod.require=id=>id==='@/app/api/utils/sql'?{__esModule:true,default:sql}:id==='@/app/api/utils/push'?{
 ensurePushTokenTable:async()=>{},sendPushToUser:async(user,payload)=>{pushes.push({user,payload});return {attempted:success,succeeded:success,failed:0};}
}:id==='@/lib/crop-yield-reminders'?{sendDailyYieldReminders:async()=>({sent:0})}:require(id);
mod._compile(ts.transpileModule(fs.readFileSync('lib/daily-mobile-reminders.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,'reminders');
(async()=>{
 let result=await mod.exports.sendDailyMobileReminders();
 assert.equal(result.failed,4);assert.equal(marks,0,'No device delivery must remain retryable');
 success=1;result=await mod.exports.sendDailyMobileReminders();assert.equal(result.sent,4);assert.equal(marks,4);
 assert(pushes.some(p=>p.payload.url==='/farmer-profile?id=match'));
 assert(pushes.some(p=>p.payload.data.type==='profile_completion'));
 delivered=true;pushes=[];await mod.exports.sendDailyMobileReminders();assert.equal(pushes.length,0,'Already delivered reminders must be skipped');
 assert.equal(released,3);console.log('PASS: profile setup, nearest match, supplier reminders, retry without tokens, successful delivery, daily deduplication and lock release');
})().catch(e=>{console.error(e);process.exitCode=1;});
