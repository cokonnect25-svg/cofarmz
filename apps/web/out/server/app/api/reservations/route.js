(()=>{var e={};e.id=1483,e.ids=[1483],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},12521:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>v,routeModule:()=>E,serverHooks:()=>x,workAsyncStorage:()=>R,workUnitAsyncStorage:()=>m});var s={};t.r(s),t.d(s,{GET:()=>d,POST:()=>p,PUT:()=>l,dynamic:()=>c});var a=t(42706),n=t(28203),i=t(45994),o=t(97662),u=t(39187);let c="force-dynamic";async function d(e){try{let r;let t=e.nextUrl.searchParams.get("user_id"),s=e.nextUrl.searchParams.get("owner_id");return r=t?await (0,o.A)`
        SELECT r.*, 
               u.name as owner_name, 
               u.email as owner_email, 
               u.image as owner_image
        FROM reservations r
        LEFT JOIN "user" u ON r.owner_id = u.id
        WHERE r.user_id = ${t} 
        ORDER BY r.created_at DESC
      `:s?await (0,o.A)`
        SELECT r.*, 
               u.name as renter_name, 
               u.email as renter_email, 
               u.image as renter_image
        FROM reservations r
        LEFT JOIN "user" u ON r.user_id = u.id
        WHERE r.owner_id = ${s} 
        ORDER BY r.created_at DESC
      `:await (0,o.A)`SELECT * FROM reservations ORDER BY created_at DESC`,u.NextResponse.json(r)}catch(r){let e=r instanceof Error?r.message:String(r);return console.error("GET /api/reservations error:",e),u.NextResponse.json({error:"Failed to fetch reservations",details:e},{status:500})}}async function p(e){try{let{user_id:r,owner_id:t,machinery_id:s,machinery_name:a,start_date:n,end_date:i,total_days:c,daily_rate:d,total_price:p,renter_phone:l}=await e.json();if(!r||!t||!s||!a||!n||!i||!c||!d||!p)return u.NextResponse.json({error:"Missing required fields"},{status:400});await (0,o.A)`ALTER TABLE reservations ADD COLUMN IF NOT EXISTS renter_phone TEXT`.catch(()=>{});let E=await (0,o.A)`
      INSERT INTO reservations (user_id, owner_id, machinery_id, machinery_name, start_date, end_date, total_days, daily_rate, total_price, status, renter_phone)
      VALUES (${r}, ${t}, ${s}, ${a}, ${n}, ${i}, ${c}, ${d}, ${p}, 'pending', ${l||null})
      RETURNING *
    `;return u.NextResponse.json(E[0],{status:201})}catch(e){return console.error("Reservation error:",e),u.NextResponse.json({error:"Failed to create reservation"},{status:500})}}async function l(e){try{let{id:r,status:t}=await e.json();if(!r||!t)return u.NextResponse.json({error:"Missing required fields"},{status:400});if(!["pending","accepted","completed","cancelled","rejected"].includes(t))return u.NextResponse.json({error:"Invalid status"},{status:400});await (0,o.A)`ALTER TABLE reservations DROP CONSTRAINT IF EXISTS reservations_status_check`.catch(()=>{}),await (0,o.A)`ALTER TABLE reservations ADD CONSTRAINT reservations_status_check CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled', 'completed'))`.catch(()=>{});let s=await (0,o.A)`
      UPDATE reservations 
      SET status = ${t}
      WHERE id = ${r}
      RETURNING *
    `;if(0===s.length)return u.NextResponse.json({error:"Reservation not found"},{status:404});return u.NextResponse.json(s[0],{status:200})}catch(e){return console.error("Update error:",e),u.NextResponse.json({error:"Failed to update reservation"},{status:500})}}let E=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/reservations/route",pathname:"/api/reservations",filename:"route",bundlePath:"app/api/reservations/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\reservations\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:R,workUnitAsyncStorage:m,serverHooks:x}=E;function v(){return(0,i.patchFetch)({workAsyncStorage:R,workUnitAsyncStorage:m})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(12521));module.exports=s})();