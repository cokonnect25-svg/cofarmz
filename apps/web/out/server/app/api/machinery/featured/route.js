(()=>{var e={};e.id=3843,e.ids=[3843],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},94967:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>f,routeModule:()=>d,serverHooks:()=>x,workAsyncStorage:()=>l,workUnitAsyncStorage:()=>m});var s={};t.r(s),t.d(s,{GET:()=>p,dynamic:()=>c});var a=t(42706),i=t(28203),o=t(45994),n=t(97662),u=t(39187);let c="force-dynamic";async function p(){try{let e=await (0,n.A)`
      SELECT
        id,
        name,
        model,
        daily_rate,
        image_url,
        location,
        year,
        is_unavailable,
        ROUND(RANDOM() * 50)::INT as distance
      FROM machinery
      ORDER BY created_at DESC
      LIMIT 10
    `;if(!e||!Array.isArray(e))return console.error("Invalid machinery response:",e),u.NextResponse.json([],{status:200});return u.NextResponse.json(e)}catch(e){return console.error("Error fetching featured machinery:",e),u.NextResponse.json({error:"Failed to fetch machinery",details:e?.message},{status:500})}}let d=new a.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/machinery/featured/route",pathname:"/api/machinery/featured",filename:"route",bundlePath:"app/api/machinery/featured/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\machinery\\featured\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:l,workUnitAsyncStorage:m,serverHooks:x}=d;function f(){return(0,o.patchFetch)({workAsyncStorage:l,workUnitAsyncStorage:m})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(94967));module.exports=s})();