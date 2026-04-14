(()=>{var e={};e.id=8641,e.ids=[8641],e.modules={10846:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},44870:e=>{"use strict";e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},3295:e=>{"use strict";e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},29294:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},63033:e=>{"use strict";e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},55511:e=>{"use strict";e.exports=require("crypto")},29021:e=>{"use strict";e.exports=require("fs")},91645:e=>{"use strict";e.exports=require("net")},21820:e=>{"use strict";e.exports=require("os")},74998:e=>{"use strict";e.exports=require("perf_hooks")},27910:e=>{"use strict";e.exports=require("stream")},34631:e=>{"use strict";e.exports=require("tls")},90314:(e,t,r)=>{"use strict";r.r(t),r.d(t,{patchFetch:()=>l,routeModule:()=>L,serverHooks:()=>N,workAsyncStorage:()=>p,workUnitAsyncStorage:()=>d});var s={};r.r(s),r.d(s,{DELETE:()=>u,GET:()=>n,POST:()=>A,dynamic:()=>o});var a=r(42706),E=r(28203),T=r(45994),i=r(97662),c=r(39187);let o="force-dynamic";async function A(){let e=[];try{await (0,i.A)`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT false,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(()=>{}),await (0,i.A)`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        token TEXT NOT NULL UNIQUE,
        "expiresAt" TIMESTAMP NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(()=>{}),await (0,i.A)`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        "idToken" TEXT,
        password TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `.catch(()=>{}),await (0,i.A)`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      )
    `.catch(()=>{}),e.push("better-auth tables ensured"),await (0,i.A)`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,e.push("roles table ensured"),await (0,i.A)`
      INSERT INTO roles (id, name, display_name, description)
      VALUES
        (1, 'farmer', 'Farmer', 'Can list machinery, crops, rent equipment'),
        (2, 'buyer', 'Buyer', 'Can rent machinery and purchase crops')
      ON CONFLICT (id) DO NOTHING
    `,await (0,i.A)`DELETE FROM roles WHERE name = 'admin'`.catch(()=>{}),await (0,i.A)`UPDATE "user" SET role = 'buyer', role_id = 2 WHERE role = 'admin'`.catch(()=>{}),e.push("roles seeded, admin removed"),await (0,i.A)`UPDATE crops SET crop_name = TRIM(crop_name), crop_type = 'grow'`.catch(()=>{}),e.push("crop names trimmed, crop_type normalized"),await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'
    `,e.push("role column ensured"),await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS role_id INTEGER REFERENCES roles(id)
    `.catch(()=>{}),await (0,i.A)`ALTER TABLE "user" ALTER COLUMN role_id DROP NOT NULL`.catch(()=>{}),e.push("role_id column ensured (nullable)"),await (0,i.A)`
      CREATE TABLE IF NOT EXISTS crops (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        crop_name VARCHAR(100) NOT NULL,
        years_of_experience INTEGER,
        expertise_level VARCHAR(50) DEFAULT 'Beginner',
        expected_yield_date DATE,
        expected_yield_quantity NUMERIC,
        expected_yield_quantity_uom VARCHAR(20) DEFAULT 'kg',
        crop_type VARCHAR(20) DEFAULT 'grow',
        is_crop_waste BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,e.push("crops table ensured"),await (0,i.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS crop_type VARCHAR(20) DEFAULT 'grow'`.catch(()=>{}),await (0,i.A)`ALTER TABLE crops ADD COLUMN IF NOT EXISTS is_crop_waste BOOLEAN DEFAULT false`.catch(()=>{}),await (0,i.A)`ALTER TABLE crops DROP CONSTRAINT IF EXISTS crops_crop_type_check`.catch(()=>{}),e.push("crop_type/is_crop_waste columns ensured, check constraint dropped"),await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)
    `,await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)
    `,e.push("latitude/longitude columns ensured"),await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS location TEXT
    `,e.push("location column ensured"),await (0,i.A)`
      ALTER TABLE "user"
      ADD COLUMN IF NOT EXISTS phone TEXT
    `,e.push("phone column ensured"),await (0,i.A)`
      ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role_confirmed BOOLEAN DEFAULT false
    `,e.push("role_confirmed column ensured"),await (0,i.A)`
      UPDATE "user" u
      SET role_id = r.id
      FROM roles r
      WHERE r.name = u.role AND u.role_confirmed = true AND (u.role_id IS NULL OR u.role_id != r.id)
    `,e.push("role_id synced for confirmed users only");let t=await (0,i.A)`
      SELECT role, COUNT(*) as count FROM "user" GROUP BY role
    `;e.push(`user roles: ${JSON.stringify(t)}`);let r=await (0,i.A)`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;e.push(`tables: ${r.map(e=>e.table_name).join(", ")}`);let s="test_"+Date.now();try{await (0,i.A)`INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES (${s}, 'Test', 'test_probe@test.com', false, NOW(), NOW()) ON CONFLICT DO NOTHING`,await (0,i.A)`DELETE FROM "user" WHERE id = ${s}`,e.push("user table insert test: OK")}catch(t){e.push(`user table insert test FAILED: ${t.message}`)}return c.NextResponse.json({success:!0,results:e})}catch(t){return c.NextResponse.json({success:!1,error:t.message,results:e},{status:500})}}async function n(){try{let e=(process.env.DATABASE_URL||"NOT SET").replace(/:[^:@]*@/,":***@").split("?")[0],[t,r,s]=await Promise.all([(0,i.A)`
        SELECT id, name, email, role, role_id, latitude, longitude, location
        FROM "user"
        ORDER BY "createdAt" DESC
        LIMIT 50
      `.catch(()=>[]),(0,i.A)`
        SELECT c.id, c.user_id, c.crop_name, c.crop_type, u.email, u.name, u.role
        FROM crops c
        LEFT JOIN "user" u ON c.user_id = u.id
        ORDER BY c.created_at DESC
        LIMIT 50
      `.catch(()=>[]),(0,i.A)`SELECT * FROM roles ORDER BY id`.catch(()=>[])]);return c.NextResponse.json({db_host:e,users:t,crops:r,roles:s})}catch(e){return c.NextResponse.json({error:e.message},{status:500})}}async function u(){try{return await (0,i.A)`DELETE FROM reel_likes`.catch(()=>{}),await (0,i.A)`DELETE FROM reel_comments`.catch(()=>{}),await (0,i.A)`DELETE FROM reels`.catch(()=>{}),await (0,i.A)`DELETE FROM messages`.catch(()=>{}),await (0,i.A)`DELETE FROM follows`.catch(()=>{}),await (0,i.A)`DELETE FROM favorites`.catch(()=>{}),await (0,i.A)`DELETE FROM reservations`.catch(()=>{}),await (0,i.A)`DELETE FROM reviews`.catch(()=>{}),await (0,i.A)`DELETE FROM crops`.catch(()=>{}),await (0,i.A)`DELETE FROM machinery_unavailability`.catch(()=>{}),await (0,i.A)`DELETE FROM machinery`.catch(()=>{}),await (0,i.A)`DELETE FROM password_reset_tokens`.catch(()=>{}),await (0,i.A)`DELETE FROM session`.catch(()=>{}),await (0,i.A)`DELETE FROM account`.catch(()=>{}),await (0,i.A)`DELETE FROM "user"`.catch(()=>{}),c.NextResponse.json({success:!0,message:"All users and data deleted"})}catch(e){return c.NextResponse.json({error:e.message},{status:500})}}let L=new a.AppRouteRouteModule({definition:{kind:E.RouteKind.APP_ROUTE,page:"/api/setup/route",pathname:"/api/setup",filename:"route",bundlePath:"app/api/setup/route"},resolvedPagePath:"C:\\Users\\sures\\Downloads\\cofarmzfinalwebsitee (2)\\cofarmzfinalwebsitee\\finalzaccc\\apps\\web\\app\\api\\setup\\route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:p,workUnitAsyncStorage:d,serverHooks:N}=L;function l(){return(0,T.patchFetch)({workAsyncStorage:p,workUnitAsyncStorage:d})}},96487:()=>{},78335:()=>{},97662:(e,t,r)=>{"use strict";r.d(t,{A:()=>s});let s=(0,r(73186).A)(process.env.DATABASE_URL,{ssl:{rejectUnauthorized:!1},max:10,idle_timeout:30,connect_timeout:10})}};var t=require("../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),s=t.X(0,[5994,5452,3186],()=>r(90314));module.exports=s})();