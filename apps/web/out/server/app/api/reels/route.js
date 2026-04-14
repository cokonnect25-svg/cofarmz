(()=>{var e={};e.id=3141,e.ids=[3141],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},55464:(e,r,s)=>{"use strict";s.r(r),s.d(r,{patchFetch:()=>S,routeModule:()=>_,serverHooks:()=>p,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>R});var t={};s.r(t),s.d(t,{GET:()=>n,POST:()=>E,dynamic:()=>d});var i=s(42706),a=s(28203),l=s(45994),o=s(97662),u=s(39187);let d="force-dynamic";async function n(e){try{let r;await (0,o.A)`ALTER TABLE reels ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0`.catch(()=>{});let{searchParams:s}=new URL(e.url),t=s.get("userId"),i=s.get("currentUserId"),a=s.get("cursor"),l=Math.min(parseInt(s.get("limit")||"10"),50);if(t)r=a?await (0,o.A)`
          SELECT
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            ${i?(0,o.A)`EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${i})`:(0,o.A)`false`} as is_liked,
            ${i?(0,o.A)`EXISTS(SELECT 1 FROM follows WHERE user_id = ${i} AND following_id = r.user_id)`:(0,o.A)`false`} as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.user_id = ${t}
            AND r.created_at < ${new Date(a)}
          ORDER BY r.created_at DESC
          LIMIT ${l+1}
        `:await (0,o.A)`
          SELECT
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            ${i?(0,o.A)`EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${i})`:(0,o.A)`false`} as is_liked,
            ${i?(0,o.A)`EXISTS(SELECT 1 FROM follows WHERE user_id = ${i} AND following_id = r.user_id)`:(0,o.A)`false`} as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.user_id = ${t}
          ORDER BY r.created_at DESC
          LIMIT ${l+1}
        `;else{if(!i)return u.NextResponse.json({error:"Missing userId or currentUserId"},{status:400});r=a?await (0,o.A)`
          SELECT 
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${i}) as is_liked,
            EXISTS(SELECT 1 FROM follows WHERE user_id = ${i} AND following_id = r.user_id) as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          WHERE r.created_at < ${new Date(a)}
          ORDER BY 
            is_followed DESC,
            r.created_at DESC
          LIMIT ${l+1}
        `:await (0,o.A)`
          SELECT 
            r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
            u.name, u.image,
            (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.id) as likes,
            (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) as comments,
            COALESCE(r.views, 0) as views,
            EXISTS(SELECT 1 FROM reel_likes WHERE reel_id = r.id AND user_id = ${i}) as is_liked,
            EXISTS(SELECT 1 FROM follows WHERE user_id = ${i} AND following_id = r.user_id) as is_followed
          FROM reels r
          JOIN "user" u ON r.user_id = u.id
          ORDER BY
            is_followed DESC,
            r.created_at DESC
          LIMIT ${l+1}
        `}let d=r.length>l,n=r.slice(0,l),E=d?n[n.length-1]?.created_at:null;return u.NextResponse.json({data:n,nextCursor:E,hasMore:d})}catch(e){return console.error("Get reels error:",e),u.NextResponse.json({error:"Failed to get reels"},{status:500})}}async function E(e){try{let{videoUrl:r,caption:s,thumbnailUrl:t}=await e.json(),i=e.headers.get("x-user-id");if(!i||!r)return u.NextResponse.json({error:"Missing required fields"},{status:400});let a=`reel_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,l=await (0,o.A)`
      INSERT INTO reels (id, user_id, video_url, caption, thumbnail_url)
      VALUES (${a}, ${i}, ${r}, ${s||null}, ${t||null})
      RETURNING *
    `;return u.NextResponse.json(l[0],{status:201})}catch(e){return console.error("Create reel error:",e),u.NextResponse.json({error:"Failed to create reel"},{status:500})}}let _=new i.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/reels/route",pathname:"/api/reels",filename:"route",bundlePath:"app/api/reels/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\reels\\route.ts",nextConfigOutput:"",userland:t}),{workAsyncStorage:c,workUnitAsyncStorage:R,serverHooks:p}=_;function S(){return(0,l.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:R})}},96487:()=>{},78335:()=>{},97662:(e,r,s)=>{"use strict";s.d(r,{A:()=>t});let t=(0,s(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var r=require("../../../webpack-runtime.js");r.C(e);var s=e=>r(r.s=e),t=r.X(0,[5994,5452,3186],()=>s(55464));module.exports=t})();