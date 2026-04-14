(()=>{var e={};e.id=6108,e.ids=[6108],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},58297:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>_,routeModule:()=>c,serverHooks:()=>E,workAsyncStorage:()=>p,workUnitAsyncStorage:()=>m});var a={};r.r(a),r.d(a,{GET:()=>d,dynamic:()=>l});var i=r(42706),s=r(28203),n=r(45994),o=r(97662),u=r(39187);let l="force-dynamic";async function d(e){try{let t;let r=e.nextUrl.searchParams,a=parseFloat(r.get("latitude")||"0"),i=parseFloat(r.get("longitude")||"0"),s=r.get("distance")?parseInt(r.get("distance")||"50"):null;parseFloat(r.get("minRating")||"0");let n=r.get("crops")?.split(",").filter(Boolean)||[],l=r.get("equipment")?.split(",").filter(Boolean)||[],d=r.get("yieldDateFrom")||null,c=r.get("yieldDateTo")||null,p=r.get("type")||"farmers",m="true"===r.get("wasteOnly"),E=r.get("currentUserId");await (0,o.A)`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`.catch(()=>{}),await (0,o.A)`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(()=>{});let _="farmers"===p?"farmer":"buyer";try{t=await (0,o.A)`
        SELECT
          u.id, u.name, u.email,
          COALESCE(u.image, 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || u.id) as image,
          u.latitude, u.longitude,
          COALESCE(u.location, '') as location,
          COALESCE(u.phone, '') as phone,
          u.role,
          COUNT(DISTINCT m.id) as equipment_count
        FROM "user" u
        LEFT JOIN machinery m ON u.id = m.owner_id
        WHERE u.role = ${_}
          ${E?(0,o.A)`AND u.id != ${E}`:(0,o.A)``}
        GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, u.role
      `}catch{t=await (0,o.A)`
        SELECT
          u.id, u.name, u.email,
          COALESCE(u.image, 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || u.id) as image,
          u.latitude, u.longitude,
          COALESCE(u.location, '') as location,
          COALESCE(u.phone, '') as phone,
          r.name as role,
          COUNT(DISTINCT m.id) as equipment_count
        FROM "user" u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN machinery m ON u.id = m.owner_id
        WHERE (r.name = ${_} OR u.role_id = ${"farmer"===_?1:2})
          ${E?(0,o.A)`AND u.id != ${E}`:(0,o.A)``}
        GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, r.name
      `}let g=(e,t,r,a)=>{let i=(r-e)*Math.PI/180,s=(a-t)*Math.PI/180,n=Math.sin(i/2)*Math.sin(i/2)+Math.cos(e*Math.PI/180)*Math.cos(r*Math.PI/180)*Math.sin(s/2)*Math.sin(s/2),o=2*Math.atan2(Math.sqrt(n),Math.sqrt(1-n));return 6371*o},h=0!==a||0!==i,A=t.map(e=>({...e,distance:h&&null!=e.latitude&&null!=e.longitude?g(a,i,parseFloat(e.latitude),parseFloat(e.longitude)):9999})),f=null!==s?A.filter(e=>e.distance<=s||9999===e.distance):A,w=[];(n.length>0||m)&&(m&&"buyers"===p?w=(await (0,o.A)`
          SELECT DISTINCT c.user_id
          FROM crops c
          JOIN "user" u ON c.user_id = u.id
          WHERE c.is_crop_waste = true AND u.role = 'buyer'
        `).map(e=>e.user_id):n.length>0&&(w=(await (0,o.A)`
          SELECT DISTINCT user_id
          FROM crops
          WHERE LOWER(crop_name) IN (${o.A.join(n.map(e=>e.toLowerCase()),(0,o.A)`, `)})
          ${d||c?(0,o.A)`AND expected_yield_date IS NOT NULL`:(0,o.A)``}
          ${d&&c?(0,o.A)`AND expected_yield_date BETWEEN ${d}::date AND ${c}::date`:d?(0,o.A)`AND expected_yield_date >= ${d}::date`:c?(0,o.A)`AND expected_yield_date <= ${c}::date`:(0,o.A)``}
        `).map(e=>e.user_id)));let O=[];if(l.length>0&&(O=(await (0,o.A)`
        SELECT DISTINCT owner_id 
        FROM machinery 
        WHERE name ILIKE ${`%${l[0]}%`}
      `).map(e=>e.owner_id),l.length>1))for(let e=1;e<l.length;e++){let t=(await (0,o.A)`
            SELECT DISTINCT owner_id 
            FROM machinery 
            WHERE name ILIKE ${`%${l[e]}%`}
          `).map(e=>e.owner_id);O=[...new Set([...O,...t])]}let x=f;(n.length>0||m)&&(x=x.filter(e=>w.includes(e.id))),l.length>0&&(x=x.filter(e=>O.includes(e.id)));let T=x.map(e=>e.id),C=[],N=[],R=[],y=[];T.length>0&&([C,N,R,y]=await Promise.all([(0,o.A)`
          SELECT user_id, crop_name, years_of_experience, expertise_level, is_crop_waste
          FROM crops
          WHERE user_id = ANY(${T}::text[])
          ORDER BY created_at DESC
        `,(0,o.A)`
          SELECT id, name, model, daily_rate, image_url, owner_id
          FROM machinery
          WHERE owner_id = ANY(${T}::text[])
          ORDER BY created_at DESC
        `,(0,o.A)`
          SELECT following_id, COUNT(*)::integer as count
          FROM follows
          WHERE following_id = ANY(${T}::text[])
          GROUP BY following_id
        `,(0,o.A)`
          SELECT user_id, COUNT(*)::integer as count
          FROM follows
          WHERE user_id = ANY(${T}::text[])
          GROUP BY user_id
        `]));let I=new Map,S=new Map,L=new Map,M=new Map;C.forEach(e=>{I.has(e.user_id)||I.set(e.user_id,[]),I.get(e.user_id).push({crop_name:e.crop_name,years_of_experience:e.years_of_experience,expertise_level:e.expertise_level,is_crop_waste:e.is_crop_waste})}),N.forEach(e=>{S.has(e.owner_id)||S.set(e.owner_id,[]),S.get(e.owner_id).push({id:e.id,name:e.name,model:e.model,daily_rate:e.daily_rate,image_url:e.image_url})}),R.forEach(e=>{L.set(e.following_id,e.count||0)}),y.forEach(e=>{M.set(e.user_id,e.count||0)});let D=x.map(e=>{let t=I.get(e.id)||[],r=(S.get(e.id)||[]).slice(0,5);return{...e,crops:t,crops_count:t.length,equipment:r,equipment_count:parseInt(e.equipment_count)||0,rating:null,followers_count:L.get(e.id)||0,following_count:M.get(e.id)||0}});return D.sort((e,t)=>e.distance-t.distance),u.NextResponse.json(D)}catch(t){let e=t instanceof Error?t.message:String(t);return console.error("Error fetching nearby farmers:",e),u.NextResponse.json({error:"Failed to fetch nearby farmers",details:e},{status:500})}}let c=new i.AppRouteRouteModule({definition:{kind:s.RouteKind.APP_ROUTE,page:"/api/nearby-farmers/route",pathname:"/api/nearby-farmers",filename:"route",bundlePath:"app/api/nearby-farmers/route"},resolvedPagePath:"C:\\Users\\nivet\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\nearby-farmers\\route.ts",nextConfigOutput:"",userland:a}),{workAsyncStorage:p,workUnitAsyncStorage:m,serverHooks:E}=c;function _(){return(0,n.patchFetch)({workAsyncStorage:p,workUnitAsyncStorage:m})}},96487:()=>{},78335:()=>{},97662:(e,t,r)=>{"use strict";r.d(t,{A:()=>a});let a=(0,r(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[5994,5452,3186],()=>r(58297));module.exports=a})();