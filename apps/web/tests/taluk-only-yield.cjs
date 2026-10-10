const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const db=require('postgres')('postgres://postgres@127.0.0.1:55439/postgres',{max:4,onnotice:()=>{},connection:{search_path:'taluk_yield_test'}});
let pushes=[],fail=false;
function load(file){const mod=new Module(file,module);mod.require=id=>id==='@/app/api/utils/sql'?{__esModule:true,default:db}:id==='@/app/api/utils/push'?{sendPushToUser:async(user,payload)=>{pushes.push({user,payload});return {failed:fail?1:0,succeeded:fail?0:1};}}:id==='./fpo-location'?{addressPhrases:()=>[],fpoName:()=>''}:id==='./fpo-error'?{FpoError:Error}:require(id);mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return mod.exports;}
(async()=>{try{
 await db.unsafe('CREATE SCHEMA taluk_yield_test');
 await db.unsafe(`CREATE TABLE "user"(id text PRIMARY KEY,role text,district_id bigint,taluk_id bigint);
 CREATE TABLE fpo_districts(id bigint PRIMARY KEY);INSERT INTO fpo_districts VALUES(1);
 CREATE TABLE digital_fpos(id uuid PRIMARY KEY,district_id bigint,taluk_id bigint,status text);
 CREATE TABLE farmer_groups(id uuid PRIMARY KEY,digital_fpo_id uuid);
 CREATE TABLE farmer_fpo_assignments(farmer_id text PRIMARY KEY,district_id bigint,taluk_id bigint,group_id uuid,assignment_status text,assigned_at timestamptz,reason text,updated_at timestamptz);
 CREATE TABLE crops(id serial PRIMARY KEY,user_id text,crop_name text,expected_yield_date date);
 INSERT INTO "user" VALUES('farmer','farmer',1,11),('unknown','farmer',1,NULL),('buyer','buyer',1,11);
 INSERT INTO digital_fpos VALUES('10000000-0000-0000-0000-000000000001',1,NULL,'active'),('10000000-0000-0000-0000-000000000002',1,11,'active');
 INSERT INTO farmer_groups VALUES('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002');
 INSERT INTO farmer_fpo_assignments VALUES('unknown',1,NULL,'20000000-0000-0000-0000-000000000001','assigned',now(),NULL,now()),('farmer',1,11,'20000000-0000-0000-0000-000000000002','assigned',now(),NULL,now());`);
 const migration=fs.readFileSync('migrations/20261010_taluk_only_membership.sql','utf8');const conn=await db.reserve();try{await conn.unsafe(migration);await conn.unsafe(migration);}finally{conn.release();}
 await db.unsafe('CREATE TRIGGER enforce_membership BEFORE INSERT OR UPDATE ON farmer_fpo_assignments FOR EACH ROW EXECUTE FUNCTION check_fpo_membership()');
 await assert.rejects(db`UPDATE farmer_fpo_assignments SET group_id='20000000-0000-0000-0000-000000000001' WHERE farmer_id='unknown'`,/Invalid farmer district/);
 const [removed]=await db`SELECT * FROM farmer_fpo_assignments WHERE farmer_id='unknown'`;assert.equal(removed.group_id,null);assert.equal(removed.assignment_status,'pending_fpo');
 let [access]=await db`SELECT can_receive_fpo_message('farmer','20000000-0000-0000-0000-000000000002') AS allowed`;assert.equal(access.allowed,true);
 [access]=await db`SELECT can_receive_fpo_message('unknown','20000000-0000-0000-0000-000000000001') AS allowed`;assert.equal(access.allowed,false);
 const {selectFarmerFpo}=load('lib/fpo-taluk.ts');assert.equal(selectFarmerFpo('1',null,[{district_id:1,taluk_id:null,status:'active'}]),null);
 assert.equal(selectFarmerFpo('1','12',[{district_id:1,taluk_id:null,status:'active'}]),null);
 await db`INSERT INTO crops(user_id,crop_name,expected_yield_date) VALUES
 ('farmer','Rice',(now() AT TIME ZONE 'Asia/Kolkata')::date-1),
 ('farmer','Wheat',(now() AT TIME ZONE 'Asia/Kolkata')::date-2),
 ('unknown','Today',(now() AT TIME ZONE 'Asia/Kolkata')::date),
 ('buyer','Buyer crop',(now() AT TIME ZONE 'Asia/Kolkata')::date-1)`;
 const {sendDailyYieldReminders}=load('lib/crop-yield-reminders.ts');
 let result=await sendDailyYieldReminders();assert.equal(result.sent,1);assert.equal(pushes.length,1);assert.equal(pushes[0].user,'farmer');assert(pushes[0].payload.body.includes('Rice, Wheat'));assert.equal(pushes[0].payload.url,'/user-profile#current-crops');
 await sendDailyYieldReminders();assert.equal(pushes.length,1,'Multiple sweeps must not resend today');
 await db`UPDATE crop_yield_reminders SET reminder_day=reminder_day-1`;
 await sendDailyYieldReminders();assert.equal(pushes.length,2,'Overdue crops are reminded again next day');
 await db`UPDATE crops SET expected_yield_date=(now() AT TIME ZONE 'Asia/Kolkata')::date+10 WHERE user_id='farmer'`;
 await db`DELETE FROM crop_yield_reminders`;await sendDailyYieldReminders();assert.equal(pushes.length,2,'Updated future dates stop reminders');
 await db`UPDATE crops SET expected_yield_date=(now() AT TIME ZONE 'Asia/Kolkata')::date-1 WHERE user_id='farmer'`;fail=true;result=await sendDailyYieldReminders();assert.equal(result.failed,1);
 fail=false;result=await sendDailyYieldReminders();assert.equal(result.sent,1,'Retry failed delivery');
 console.log('PASS: idempotent district detachment, taluk access, no district fallback, India-date boundaries, farmer-only daily aggregation, deduplication, retry and stop after date update');
 }finally{await db.unsafe('DROP SCHEMA IF EXISTS taluk_yield_test CASCADE');await db.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
