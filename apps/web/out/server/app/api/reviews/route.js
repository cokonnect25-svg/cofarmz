(()=>{var e={};e.id=9217,e.ids=[9217],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},87496:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>f,routeModule:()=>R,serverHooks:()=>x,workAsyncStorage:()=>v,workUnitAsyncStorage:()=>E});var s={};t.r(s),t.d(s,{DELETE:()=>w,GET:()=>p,POST:()=>d,PUT:()=>l,dynamic:()=>c});var i=t(42706),n=t(28203),o=t(45994),a=t(97662),u=t(39187);let c="force-dynamic";async function p(e){let{searchParams:r}=new URL(e.url),t=r.get("machinery_id"),s=r.get("user_id");try{if(t){let e=await (0,a.A)`
        SELECT 
          r.*,
          u.name as reviewer_name,
          u.image as reviewer_image
        FROM reviews r
        JOIN "user" u ON r.user_id = u.id
        WHERE r.machinery_id = ${t}
        ORDER BY r.created_at DESC
      `;return u.NextResponse.json(e)}if(s){let e=await (0,a.A)`
        SELECT * FROM reviews
        WHERE user_id = ${s}
        ORDER BY created_at DESC
      `;return u.NextResponse.json(e)}return u.NextResponse.json({error:"Missing parameters"},{status:400})}catch(e){return console.error("Error fetching reviews:",e),u.NextResponse.json({error:"Failed to fetch reviews"},{status:500})}}async function d(e){let{user_id:r,machinery_id:t,reservation_id:s,rating:i,review_text:n}=await e.json();try{if((await (0,a.A)`
      SELECT id FROM reviews WHERE reservation_id = ${s} AND user_id = ${r}
    `).length>0)return u.NextResponse.json({error:"You have already reviewed this booking"},{status:400});let e=await (0,a.A)`
      INSERT INTO reviews (user_id, machinery_id, reservation_id, rating, review_text)
      VALUES (${r}, ${t}, ${s}, ${i}, ${n})
      RETURNING *
    `;return u.NextResponse.json(e[0])}catch(e){return console.error("Error creating review:",e),u.NextResponse.json({error:"Failed to create review"},{status:500})}}async function l(e){let{id:r,rating:t,review_text:s}=await e.json();try{let e=await (0,a.A)`
      UPDATE reviews
      SET rating = ${t}, review_text = ${s}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${r}
      RETURNING *
    `;if(0===e.length)return u.NextResponse.json({error:"Review not found"},{status:404});return u.NextResponse.json(e[0])}catch(e){return console.error("Error updating review:",e),u.NextResponse.json({error:"Failed to update review"},{status:500})}}async function w(e){let{searchParams:r}=new URL(e.url),t=r.get("id");try{let e=await (0,a.A)`DELETE FROM reviews WHERE id = ${t} RETURNING id`;if(0===e.length)return u.NextResponse.json({error:"Review not found"},{status:404});return u.NextResponse.json({success:!0})}catch(e){return console.error("Error deleting review:",e),u.NextResponse.json({error:"Failed to delete review"},{status:500})}}let R=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/reviews/route",pathname:"/api/reviews",filename:"route",bundlePath:"app/api/reviews/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\reviews\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:v,workUnitAsyncStorage:E,serverHooks:x}=R;function f(){return(0,o.patchFetch)({workAsyncStorage:v,workUnitAsyncStorage:E})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(87496));module.exports=s})();