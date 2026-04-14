(()=>{var e={};e.id=6100,e.ids=[6100],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},92124:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>v,routeModule:()=>l,serverHooks:()=>g,workAsyncStorage:()=>x,workUnitAsyncStorage:()=>m});var s={};r.r(s),r.d(s,{GET:()=>p,PUT:()=>c,dynamic:()=>d});var o=r(42706),i=r(28203),a=r(45994),n=r(97662),u=r(39187);let d="force-dynamic";async function p(e,{params:t}){try{let{id:e}=await t,r=await (0,n.A)`SELECT * FROM "user" WHERE id = ${e}`;if(0===r.length)return u.NextResponse.json({error:"User not found"},{status:404});return u.NextResponse.json(r[0])}catch(e){return console.error("GET /api/users/[id]:",e),u.NextResponse.json({error:"Failed to fetch user"},{status:500})}}async function c(e,{params:t}){try{let r;let{id:s}=await t,{name:o,email:i,image:a,location:d,latitude:p,longitude:c}=await e.json();console.log("PUT /api/users/[id] - Updating user:",{id:s,hasImage:!!a,name:o,email:i});let l=await (0,n.A)`SELECT * FROM "user" WHERE id = ${s}`;if(0===l.length)return u.NextResponse.json({error:"User not found"},{status:404});if(console.log("User found, updating...",l[0]),r=void 0!==a?await (0,n.A)`
        UPDATE "user" 
        SET 
          image = ${a},
          name = ${void 0!==o?o:l[0].name},
          email = ${void 0!==i?i:l[0].email},
          location = ${void 0!==d?d:l[0].location},
          latitude = ${void 0!==p?p:l[0].latitude},
          longitude = ${void 0!==c?c:l[0].longitude},
          "updatedAt" = ${new Date().toISOString()}
        WHERE id = ${s}
        RETURNING *
      `:await (0,n.A)`
        UPDATE "user" 
        SET 
          name = ${void 0!==o?o:l[0].name},
          email = ${void 0!==i?i:l[0].email},
          location = ${void 0!==d?d:l[0].location},
          latitude = ${void 0!==p?p:l[0].latitude},
          longitude = ${void 0!==c?c:l[0].longitude},
          "updatedAt" = ${new Date().toISOString()}
        WHERE id = ${s}
        RETURNING *
      `,console.log("Update result:",r),0===r.length)return u.NextResponse.json({error:"Failed to update user"},{status:500});return u.NextResponse.json(r[0])}catch(e){return console.error("PUT /api/users/[id]:",e),u.NextResponse.json({error:"Failed to update user",details:e instanceof Error?e.message:String(e)},{status:500})}}let l=new o.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/users/[id]/route",pathname:"/api/users/[id]",filename:"route",bundlePath:"app/api/users/[id]/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\users\\[id]\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:x,workUnitAsyncStorage:m,serverHooks:g}=l;function v(){return(0,a.patchFetch)({workAsyncStorage:x,workUnitAsyncStorage:m})}},96487:()=>{},78335:()=>{},97662:(e,t,r)=>{"use strict";r.d(t,{A:()=>s});let s=(0,r(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[5994,5452,3186],()=>r(92124));module.exports=s})();