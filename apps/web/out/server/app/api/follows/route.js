(()=>{var e={};e.id=9896,e.ids=[9896],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},38038:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>x,routeModule:()=>p,serverHooks:()=>R,workAsyncStorage:()=>w,workUnitAsyncStorage:()=>E});var s={};t.r(s),t.d(s,{DELETE:()=>f,GET:()=>c,POST:()=>d,dynamic:()=>l});var o=t(42706),i=t(28203),n=t(45994),u=t(97662),a=t(39187);let l="force-dynamic";async function d(e){try{let{followingId:r}=await e.json(),t=e.headers.get("x-user-id");if(!t||!r)return a.NextResponse.json({error:"Missing userId or followingId"},{status:400});if((await (0,u.A)`
      SELECT id FROM follows WHERE user_id = ${t} AND following_id = ${r}
    `).length>0)return a.NextResponse.json({error:"Already following"},{status:400});let s=await (0,u.A)`
      INSERT INTO follows (user_id, following_id)
      VALUES (${t}, ${r})
      RETURNING *
    `;return a.NextResponse.json(s[0],{status:201})}catch(e){return console.error("Follow error:",e),a.NextResponse.json({error:"Failed to follow user"},{status:500})}}async function f(e){try{let{followingId:r}=await e.json(),t=e.headers.get("x-user-id");if(!t||!r)return a.NextResponse.json({error:"Missing userId or followingId"},{status:400});return await (0,u.A)`
      DELETE FROM follows WHERE user_id = ${t} AND following_id = ${r}
    `,a.NextResponse.json({success:!0})}catch(e){return console.error("Unfollow error:",e),a.NextResponse.json({error:"Failed to unfollow user"},{status:500})}}async function c(e){try{let{searchParams:r}=new URL(e.url),t=r.get("farmerId")||r.get("user_id"),s=r.get("type");if(!t)return a.NextResponse.json({error:"Missing userId or farmerId"},{status:400});if("followers"===s){let e=await (0,u.A)`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.user_id = u.id
        WHERE f.following_id = ${t}
        ORDER BY f.created_at DESC
      `;return a.NextResponse.json(e)}if("following"===s){let e=await (0,u.A)`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.following_id = u.id
        WHERE f.user_id = ${t}
        ORDER BY f.created_at DESC
      `;return a.NextResponse.json(e)}if("both"===s){let e=await (0,u.A)`
        SELECT COUNT(*) as count FROM follows
        WHERE following_id = ${t}
      `,r=await (0,u.A)`
        SELECT COUNT(*) as count FROM follows
        WHERE user_id = ${t}
      `,s=e&&e.length>0?parseInt(e[0].count||0):0,o=r&&r.length>0?parseInt(r[0].count||0):0;return a.NextResponse.json({followers_count:s,following_count:o})}let o=await (0,u.A)`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.user_id = u.id
      WHERE f.following_id = ${t}
      ORDER BY f.created_at DESC
    `,i=await (0,u.A)`
      SELECT u.id, u.name, u.image FROM follows f
      JOIN "user" u ON f.following_id = u.id
      WHERE f.user_id = ${t}
      ORDER BY f.created_at DESC
    `;return a.NextResponse.json({followers:o,following:i})}catch(e){return console.error("Get follows error:",e),a.NextResponse.json({error:"Failed to get follows"},{status:500})}}let p=new o.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/follows/route",pathname:"/api/follows",filename:"route",bundlePath:"app/api/follows/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\follows\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:w,workUnitAsyncStorage:E,serverHooks:R}=p;function x(){return(0,n.patchFetch)({workAsyncStorage:w,workUnitAsyncStorage:E})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(38038));module.exports=s})();