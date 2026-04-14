(()=>{var e={};e.id=4986,e.ids=[4986],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},75258:(e,r,t)=>{"use strict";t.r(r),t.d(r,{patchFetch:()=>E,routeModule:()=>m,serverHooks:()=>g,workAsyncStorage:()=>y,workUnitAsyncStorage:()=>h});var s={};t.r(s),t.d(s,{GET:()=>d,POST:()=>p,dynamic:()=>u});var n=t(42706),i=t(28203),o=t(45994),a=t(97662),c=t(39187),l=t(55511);let u="force-dynamic";async function d(e){try{let r;let{searchParams:t}=new URL(e.url),s=t.get("owner_id")||t.get("ownerId");if(console.log("GET /api/machinery called, owner_id:",s),s?(console.log("Fetching machinery for owner:",s),r=await (0,a.A)`
        SELECT * FROM machinery 
        WHERE owner_id = ${s}
        ORDER BY created_at DESC
      `):(console.log("Fetching all machinery"),r=await (0,a.A)`SELECT * FROM machinery ORDER BY created_at DESC`),console.log("Query result:",r),!r||!Array.isArray(r))return console.error("Invalid query response:",r),c.NextResponse.json([],{status:200});return console.log("Returning machinery data, count:",r.length),c.NextResponse.json(r)}catch(e){return console.error("Error fetching machinery:",e),console.error("Error stack:",e?.stack),c.NextResponse.json({error:"Failed to fetch machinery",details:e?.message},{status:500})}}async function p(e){try{let r=await e.json();console.log("POST /api/machinery received body:",JSON.stringify(r));let{owner_id:t,name:s,model:n,year:i,power:o,drive:u,fuel:d,daily_rate:p,description:m,image_url:y,images:h,location:g,contact_phone:E,latitude:x,longitude:A}=r;if(!t)return console.error("Missing owner_id"),c.NextResponse.json({error:"Missing required field: owner_id"},{status:400});if(!s||!s.trim())return console.error("Missing or empty name"),c.NextResponse.json({error:"Missing required field: name"},{status:400});if(null==p||""===p)return console.error("Missing daily_rate"),c.NextResponse.json({error:"Missing required field: daily_rate"},{status:400});let R=parseFloat(p);if(isNaN(R)||R<=0)return console.error("Invalid daily_rate:",p),c.NextResponse.json({error:"daily_rate must be a positive number"},{status:400});let w=(0,l.randomUUID)();console.log("Inserting machinery with id:",w,"owner_id:",t,"name:",s,"daily_rate:",R),await (0,a.A)`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS contact_phone TEXT`.catch(()=>{}),await (0,a.A)`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)`.catch(()=>{}),await (0,a.A)`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)`.catch(()=>{}),await (0,a.A)`ALTER TABLE machinery ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'`.catch(()=>{});let f=JSON.stringify(Array.isArray(h)&&h.length>0?h:y?[y]:[]),T=await (0,a.A)`
      INSERT INTO machinery (
        id,
        owner_id,
        name,
        model,
        year,
        power,
        drive,
        fuel,
        daily_rate,
        description,
        image_url,
        images,
        location,
        contact_phone,
        latitude,
        longitude,
        created_at
      ) VALUES (
        ${w},
        ${t},
        ${s.trim()},
        ${n||null},
        ${i?parseInt(i):null},
        ${o||null},
        ${u||null},
        ${d||null},
        ${R},
        ${m||null},
        ${y||null},
        ${f}::jsonb,
        ${g||null},
        ${E||null},
        ${x||null},
        ${A||null},
        NOW()
      )
      RETURNING *
    `;return console.log("Machinery created successfully:",T[0]),c.NextResponse.json(T[0],{status:201})}catch(e){return console.error("Error creating machinery:",e.message||e),console.error("Full error:",e),c.NextResponse.json({error:"Failed to create machinery listing: "+(e.message||"Unknown error")},{status:500})}}let m=new n.AppRouteRouteModule({definition:{kind:i.RouteKind.APP_ROUTE,page:"/api/machinery/route",pathname:"/api/machinery",filename:"route",bundlePath:"app/api/machinery/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\machinery\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:y,workUnitAsyncStorage:h,serverHooks:g}=m;function E(){return(0,o.patchFetch)({workAsyncStorage:y,workUnitAsyncStorage:h})}},96487:()=>{},78335:()=>{},97662:(e,r,t)=>{"use strict";t.d(r,{A:()=>s});let s=(0,t(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var t=e=>r(r.s=e),s=r.X(0,[5994,5452,3186],()=>t(75258));module.exports=s})();