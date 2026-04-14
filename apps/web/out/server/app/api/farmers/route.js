(()=>{var e={};e.id=7430,e.ids=[7430],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},24586:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>x,routeModule:()=>d,serverHooks:()=>l,workAsyncStorage:()=>m,workUnitAsyncStorage:()=>E});var s={};t.r(s),t.d(s,{GET:()=>p,dynamic:()=>c});var a=t(42706),i=t(28203),u=t(45994),o=t(97662),n=t(39187);let c="force-dynamic";async function p(e){try{let r;let{searchParams:t}=new URL(e.url),s=t.get("currentUserId");return r=s?await (0,o.A)`
        SELECT
          u.id, u.name, u.image, u.location,
          COALESCE(
            (SELECT array_agg(DISTINCT c.crop_name) FROM crops c WHERE c.user_id = u.id),
            ARRAY[]::text[]
          ) as crops,
          (SELECT COUNT(*) FROM machinery WHERE owner_id = u.id) as equipments_count
        FROM "user" u
        WHERE u.role = 'farmer' AND u.id != ${s}
        ORDER BY u.name ASC
      `:await (0,o.A)`
        SELECT
          u.id, u.name, u.image, u.location,
          COALESCE(
            (SELECT array_agg(DISTINCT c.crop_name) FROM crops c WHERE c.user_id = u.id),
            ARRAY[]::text[]
          ) as crops,
          (SELECT COUNT(*) FROM machinery WHERE owner_id = u.id) as equipments_count
        FROM "user" u
        WHERE u.role = 'farmer'
        ORDER BY u.name ASC
      `,n.NextResponse.json(r)}catch(e){return console.error("Get farmers error:",e),n.NextResponse.json({error:"Failed to get farmers"},{status:500})}}let d=new a.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/farmers/route",pathname:"/api/farmers",filename:"route",bundlePath:"app/api/farmers/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\farmers\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:m,workUnitAsyncStorage:E,serverHooks:l}=d;function x(){return(0,u.patchFetch)({workAsyncStorage:m,workUnitAsyncStorage:E})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(24586));module.exports=s})();