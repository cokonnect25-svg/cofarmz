(()=>{var e={};e.id=4052,e.ids=[4052],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},51442:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>L,routeModule:()=>u,serverHooks:()=>p,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>d});var s={};r.r(s),r.d(s,{GET:()=>E,dynamic:()=>n});var a=r(42706),T=r(28203),i=r(45994),o=r(97662),c=r(39187);let n="force-dynamic";async function E(){let e={};try{await (0,o.A)`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,e.user="ok"}catch(t){e.user=t.message}try{await (0,o.A)`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE`,e.userEmailVerified="ok"}catch(t){e.userEmailVerified=t.message}try{await (0,o.A)`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,e.session="ok"}catch(t){e.session=t.message}try{await (0,o.A)`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        password TEXT,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        "idToken" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `,e.account="ok"}catch(t){e.account=t.message}try{await (0,o.A)`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `,e.verification="ok"}catch(t){e.verification=t.message}try{let t=await (0,o.A)`SELECT COUNT(*) as c FROM "user"`,r=await (0,o.A)`SELECT COUNT(*) as c FROM session`,s=await (0,o.A)`SELECT COUNT(*) as c FROM account`;e.userRows=t[0].c,e.sessionRows=r[0].c,e.accountRows=s[0].c}catch(t){e.counts=t.message}try{let t=await (0,o.A)`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'user'
      ORDER BY ordinal_position
    `;e.userColumns=t.map(e=>e.column_name).join(", ")}catch(t){e.userColumnsErr=t.message}try{let t=await (0,o.A)`SELECT "accountId", "providerId" FROM account LIMIT 5`;e.accounts=JSON.stringify(t)}catch(t){e.accountsErr=t.message}return c.NextResponse.json(e)}let u=new a.AppRouteRouteModule({definition:{kind:T.RouteKind.APP_ROUTE,page:"/api/db-migrate/route",pathname:"/api/db-migrate",filename:"route",bundlePath:"app/api/db-migrate/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\db-migrate\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:A,workUnitAsyncStorage:d,serverHooks:p}=u;function L(){return(0,i.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:d})}},96487:()=>{},78335:()=>{},97662:(e,t,r)=>{"use strict";r.d(t,{A:()=>s});let s=(0,r(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[5994,5452,3186],()=>r(51442));module.exports=s})();