(()=>{var e={};e.id=8918,e.ids=[8918],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},62825:(e,t,a)=>{"use strict";a.r(t),a.d(t,{patchFetch:()=>v,routeModule:()=>p,serverHooks:()=>y,workAsyncStorage:()=>_,workUnitAsyncStorage:()=>m});var r={};a.r(r),a.d(r,{GET:()=>l,POST:()=>u,dynamic:()=>c});var s=a(42706),i=a(28203),n=a(45994),d=a(97662),o=a(39187);let c="force-dynamic";async function l(e,{params:t}){try{let{id:e}=await t,a=await (0,d.A)`SELECT is_unavailable FROM machinery WHERE id = ${e}`;if(a.length>0&&a[0].is_unavailable)return o.NextResponse.json({machinery_id:e,globally_unavailable:!0,booked_dates:[]});let r=await (0,d.A)`
      SELECT start_date, end_date, status
      FROM reservations
      WHERE machinery_id = ${e} AND (status = 'accepted' OR status = 'confirmed')
      ORDER BY start_date ASC
    `,s=await (0,d.A)`
      SELECT start_date, end_date
      FROM machinery_unavailability
      WHERE machinery_id = ${e} AND start_date IS NOT NULL AND end_date IS NOT NULL
      ORDER BY start_date ASC
    `;return o.NextResponse.json({machinery_id:e,globally_unavailable:!1,booked_dates:[...r.map(e=>({start_date:e.start_date,end_date:e.end_date})),...s.map(e=>({start_date:e.start_date,end_date:e.end_date}))]})}catch(e){return console.error("Availability check error:",e),o.NextResponse.json({error:"Failed to check availability"},{status:500})}}async function u(e,{params:t}){try{let{id:a}=await t,{start_date:r,end_date:s}=await e.json(),i=await (0,d.A)`SELECT is_unavailable FROM machinery WHERE id = ${a}`;if(i.length>0&&i[0].is_unavailable)return o.NextResponse.json({available:!1,reason:"Equipment is marked as unavailable"});let n=await (0,d.A)`
      SELECT id, start_date, end_date
      FROM reservations
      WHERE machinery_id = ${a} 
        AND (status = 'accepted' OR status = 'confirmed')
        AND (
          (${r}::date < end_date AND ${s}::date > start_date)
        )
    `,c=await (0,d.A)`
      SELECT id, start_date, end_date
      FROM machinery_unavailability
      WHERE machinery_id = ${a}
        AND start_date IS NOT NULL AND end_date IS NOT NULL
        AND (
          (${r}::date < end_date AND ${s}::date > start_date)
        )
    `,l=0===n.length&&0===c.length;return o.NextResponse.json({available:l,requested_dates:{start_date:r,end_date:s},conflicting_bookings:n.map(e=>({start_date:e.start_date,end_date:e.end_date})),blocked_dates:c.map(e=>({start_date:e.start_date,end_date:e.end_date}))})}catch(e){return console.error("Availability check error:",e),o.NextResponse.json({error:"Failed to check availability"},{status:500})}}let p=new s.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/machinery/[id]/availability/route",pathname:"/api/machinery/[id]/availability",filename:"route",bundlePath:"app/api/machinery/[id]/availability/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\machinery\\[id]\\availability\\route.ts",nextConfigOutput:"",userland:r}),{workAsyncStorage:_,workUnitAsyncStorage:m,serverHooks:y}=p;function v(){return(0,n.patchFetch)({workAsyncStorage:_,workUnitAsyncStorage:m})}},96487:()=>{},78335:()=>{},97662:(e,t,a)=>{"use strict";a.d(t,{A:()=>r});let r=(0,a(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var t=require("../../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[5994,5452,3186],()=>a(62825));module.exports=r})();