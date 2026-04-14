(()=>{var e={};e.id=4881,e.ids=[4881],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},30596:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>x,routeModule:()=>E,serverHooks:()=>R,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>T});var s={};t.r(s),t.d(s,{DELETE:()=>l,GET:()=>u,POST:()=>d,PUT:()=>_,dynamic:()=>p});var o=t(42706),a=t(28203),i=t(45994),c=t(97662),n=t(39187);let p="force-dynamic";async function u(e){let{searchParams:r}=new URL(e.url),t=r.get("userId")||r.get("user_id");if(!t)return n.NextResponse.json({error:"userId is required"},{status:400});try{await (0,c.A)`CREATE TABLE IF NOT EXISTS crops (
      id SERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      crop_name VARCHAR(100) NOT NULL,
      years_of_experience INTEGER,
      expertise_level VARCHAR(50) DEFAULT 'Beginner',
      expected_yield_date DATE,
      expected_yield_quantity NUMERIC,
      expected_yield_quantity_uom VARCHAR(20) DEFAULT 'kg',
      crop_type VARCHAR(20) DEFAULT 'grow',
      is_crop_waste BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW()
    )`.catch(()=>{}),await (0,c.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(()=>{}),await (0,c.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(()=>{}),await (0,c.A)`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(()=>{});let e=await (0,c.A)`
      SELECT id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, is_crop_waste, crop_type, created_at
      FROM crops
      WHERE user_id = ${t}
      ORDER BY created_at DESC
    `;return n.NextResponse.json(e)}catch(e){return console.error("Error fetching crops:",e),n.NextResponse.json({error:`Failed to fetch crops: ${e.message}`},{status:500})}}async function d(e){try{let{user_id:r,crop_name:t,years_of_experience:s,expertise_level:o,expected_yield_date:a,expected_yield_quantity:i,expected_yield_quantity_uom:p,crop_type:u,is_crop_waste:d}=await e.json();if(!r||!t)return n.NextResponse.json({error:"user_id and crop_name are required"},{status:400});let _=t.trim();await (0,c.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(()=>{}),await (0,c.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(()=>{}),await (0,c.A)`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(()=>{});let l=await (0,c.A)`
      INSERT INTO crops (user_id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, crop_type, is_crop_waste)
      VALUES (${r}, ${_}, ${s||null}, ${o||"Beginner"}, ${a||null}, ${i||null}, ${p||"kg"}, ${u||"grow"}, ${d||!1})
      RETURNING *
    `;return n.NextResponse.json(l[0])}catch(e){return console.error("Error creating crop:",e),n.NextResponse.json({error:`Failed to create crop: ${e.message}`},{status:500})}}async function _(e){try{let{id:r,crop_name:t,years_of_experience:s,expertise_level:o,expected_yield_date:a,expected_yield_quantity:i,expected_yield_quantity_uom:p,crop_type:u,is_crop_waste:d}=await e.json();if(!r||!t)return n.NextResponse.json({error:"id and crop_name are required"},{status:400});let _=await (0,c.A)`
      UPDATE crops 
      SET crop_name = ${t}, 
          years_of_experience = ${s||null}, 
          expertise_level = ${o||"Beginner"},
          expected_yield_date = ${a||null},
          expected_yield_quantity = ${i||null},
          expected_yield_quantity_uom = ${p||"kg"},
          crop_type = ${u||"grow"},
          is_crop_waste = ${d||!1}
      WHERE id = ${parseInt(r)}
      RETURNING *
    `;return n.NextResponse.json(_[0])}catch(e){return console.error("Error updating crop:",e),n.NextResponse.json({error:"Failed to update crop"},{status:500})}}async function l(e){let{searchParams:r}=new URL(e.url),t=r.get("id");if(!t)return n.NextResponse.json({error:"id is required"},{status:400});try{return await (0,c.A)`DELETE FROM crops WHERE id = ${parseInt(t)}`,n.NextResponse.json({success:!0})}catch(e){return console.error("Error deleting crop:",e),n.NextResponse.json({error:"Failed to delete crop"},{status:500})}}let E=new o.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/farmer-crops/route",pathname:"/api/farmer-crops",filename:"route",bundlePath:"app/api/farmer-crops/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\farmer-crops\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:A,workUnitAsyncStorage:T,serverHooks:R}=E;function x(){return(0,i.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:T})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(30596));module.exports=s})();