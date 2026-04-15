(()=>{var e={};e.id=1375,e.ids=[1375],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},4498:(e,r,s)=>{"use strict";s.r(r),s.d(r,{patchFetch:()=>E,routeModule:()=>d,serverHooks:()=>_,workAsyncStorage:()=>p,workUnitAsyncStorage:()=>l});var t={};s.r(t),s.d(t,{GET:()=>m,dynamic:()=>c});var i=s(42706),a=s(28203),n=s(45994),o=s(97662),u=s(39187);let c="force-dynamic";async function m(e){let{searchParams:r}=new URL(e.url),s=r.get("userId");if(!s)return u.NextResponse.json({error:"Missing userId"},{status:400});try{let e=await (0,o.A)`
      WITH latest_messages AS (
        SELECT 
          CASE 
            WHEN sender_id = ${s} THEN receiver_id
            ELSE sender_id
          END as other_user_id,
          COALESCE(machinery_id, 'no_machinery') as machinery_key,
          machinery_id,
          message as last_message,
          created_at as last_message_time,
          ROW_NUMBER() OVER (
            PARTITION BY 
              CASE 
                WHEN sender_id = ${s} THEN receiver_id
                ELSE sender_id
              END,
              COALESCE(machinery_id, 'no_machinery')
            ORDER BY created_at DESC
          ) as rn
        FROM messages
        WHERE sender_id = ${s} OR receiver_id = ${s}
      )
      SELECT 
        lm.other_user_id,
        u.name,
        u.image,
        lm.last_message,
        lm.last_message_time,
        lm.machinery_id,
        COALESCE(m.name, '') as machinery_name,
        COALESCE(m.image_url, '') as machinery_image
      FROM latest_messages lm
      JOIN "user" u ON u.id = lm.other_user_id
      LEFT JOIN machinery m ON m.id = lm.machinery_id AND m.id IS NOT NULL
      WHERE lm.rn = 1
      ORDER BY lm.last_message_time DESC
    `;return u.NextResponse.json(e)}catch(e){return console.error("Error fetching conversations:",e),u.NextResponse.json({error:"Failed to fetch conversations"},{status:500})}}let d=new i.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/messages/conversations/route",pathname:"/api/messages/conversations",filename:"route",bundlePath:"app/api/messages/conversations/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\messages\\conversations\\route.ts",nextConfigOutput:"",userland:t}),{workAsyncStorage:p,workUnitAsyncStorage:l,serverHooks:_}=d;function E(){return(0,n.patchFetch)({workAsyncStorage:p,workUnitAsyncStorage:l})}},96487:()=>{},78335:()=>{},97662:(e,r,s)=>{"use strict";s.d(r,{A:()=>t});let t=(0,s(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../../webpack-runtime.js");r.C(e);var s=e=>r(r.s=e),t=r.X(0,[5994,5452,3186],()=>s(4498));module.exports=t})();