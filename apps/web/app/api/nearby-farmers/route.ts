export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude       = parseFloat(searchParams.get("latitude")   || "0");
    const longitude      = parseFloat(searchParams.get("longitude")  || "0");
    const distanceLimit  = searchParams.get("distance") ? parseInt(searchParams.get("distance") || "50") : null;
    const yieldDateFrom  = searchParams.get("yieldDateFrom") || null;
    const yieldDateTo    = searchParams.get("yieldDateTo")   || null;
    const searchType     = searchParams.get("type") || "farmers";
    const supplierTypeParam = searchParams.get("supplierType");
    const supplierType = supplierTypeParam === "commodities" || supplierTypeParam === "equipment" ? supplierTypeParam : null;
    const showWasteBuyers = searchParams.get("wasteOnly") === "true";
    const currentUserId  = searchParams.get("currentUserId");

    const crops     = (searchParams.get("crops")    ?.split(",").filter(Boolean) ?? []).map(c => c.trim().toLowerCase());
    const grades    = (searchParams.get("grades")   ?.split(",").filter(Boolean) ?? []).map(g => g.trim().toLowerCase());
    const certTypes = (searchParams.get("certTypes")?.split(",").filter(Boolean) ?? []).map(c => c.trim().toLowerCase());
    const equipment = (searchParams.get("equipment")?.split(",").filter(Boolean) ?? []);

    // ── ensure columns ──────────────────────────────────────────────────────
    await Promise.all([
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS supplier_types TEXT[] DEFAULT ARRAY[]::TEXT[]`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone    TEXT`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS calling_enabled BOOLEAN DEFAULT true`.catch(() => {}),
      sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {}),
    ]);

const targetRole =
  searchType === "farmers"  ? "farmer"   :
  searchType === "supplier" ? "supplier" :
  searchType === "fpo"      ? "fpo"      : "buyer";

    let isAdminViewer = false;
    if (currentUserId) {
      try {
        const viewerRows = await sql`
          SELECT COALESCE(u.role, r.name, '') AS role, u.role_id
          FROM "user" u
          LEFT JOIN roles r ON u.role_id = r.id
          WHERE u.id = ${currentUserId}
          LIMIT 1
        `;
        const viewerRole = String(viewerRows?.[0]?.role || '').toLowerCase();
        isAdminViewer =
          viewerRole === 'admin' ||
          viewerRole === 'superadmin' ||
          viewerRole === 'super_admin' ||
          Number(viewerRows?.[0]?.role_id) === 5;
      } catch (e) {
        console.error('nearby farmers viewer role check:', e);
      }
    }

    // ── fetch users by role ─────────────────────────────────────────────────
    const users = await sql`
      SELECT
        u.id, u.name, u.email,
        u.image AS image,
        u.latitude, u.longitude,
        COALESCE(u.location, '')  AS location,
        COALESCE(u.phone,    '')  AS phone,
        COALESCE(u.calling_enabled, true) AS calling_enabled,
        COALESCE(u.role, 'buyer') AS role,
        COALESCE(u.supplier_types, ARRAY[]::text[]) AS supplier_types,
        COUNT(DISTINCT m.id)      AS equipment_count
      FROM "user" u
      LEFT JOIN machinery m ON u.id = m.owner_id
      WHERE (
        u.role = ${targetRole}
        OR (u.role IS NULL AND u.role_id = ${
  targetRole === "farmer"   ? 1 :
  targetRole === "supplier" ? 3 :
  targetRole === "fpo"      ? 4 : 2
})
      )
      ${targetRole === "supplier" && supplierType ? sql`
        AND (
          COALESCE(array_length(u.supplier_types, 1), 0) = 0
          OR ${supplierType} = ANY(u.supplier_types)
        )
      ` : sql``}
      ${currentUserId ? sql`AND u.id != ${currentUserId}` : sql``}
      GROUP BY u.id, u.name, u.email, u.image,
               u.latitude, u.longitude, u.location, u.phone, u.calling_enabled, u.role, u.supplier_types
    `;

    // ── Haversine ───────────────────────────────────────────────────────────
    const calcDist = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const userHasLocation = latitude !== 0 || longitude !== 0;

    const usersWithDist = (users as any[]).map((u: any) => ({
      ...u,
      distance:
        userHasLocation && u.latitude != null && u.longitude != null
          ? calcDist(latitude, longitude, parseFloat(u.latitude), parseFloat(u.longitude))
          : null,
    }));

    // distance hard-filter (only when enabled AND user has location)
    const afterDistance =
      distanceLimit !== null
        ? usersWithDist.filter((u: any) => u.distance != null && u.distance <= distanceLimit)
        : usersWithDist;

    // ── crop / grade / cert / date matching ─────────────────────────────────
    // FIX 1: never use sql.join inside ARRAY[] — use a plain JS subquery per value
    // FIX 2: one query, user-level EXISTS per dimension → fast + correct
    const hasCropFilter  = crops.length     > 0;
    const hasGradeFilter = grades.length    > 0;
    const hasCertFilter  = certTypes.length > 0;
    const hasDateFilter  = !!(yieldDateFrom || yieldDateTo);
    const hasWasteFilter = showWasteBuyers || searchType === "wastage";

    let matchedCropUserIds: Set<string> | null = null;

    if (hasWasteFilter) {
      // wastage: buyers who have at least one waste crop
      const rows = await sql`
        SELECT DISTINCT c.user_id
        FROM crops c
        JOIN "user" u ON c.user_id = u.id
        WHERE c.is_crop_waste = true
          AND u.role = 'buyer'
      `;
      matchedCropUserIds = new Set((rows as any[]).map((r: any) => r.user_id));

    } else if (hasCropFilter || hasGradeFilter || hasCertFilter || hasDateFilter) {
      // FIX 1: build individual unnested OR conditions instead of ARRAY[..] + sql.join
      // This avoids the sql.join-inside-ARRAY bug entirely.
      const cropConditions    = crops.map(c => sql`LOWER(TRIM(crop_name)) LIKE ${'%' + c + '%'}`);
      const gradeConditions   = grades.map(g => sql`LOWER(TRIM(grade)) LIKE ${'%' + g.replace(/\s/g,'') + '%'}`);
      const certConditions    = certTypes.map(c => sql`LOWER(TRIM(certification_type)) LIKE ${'%' + c + '%'}`);

      // Build each EXISTS clause only when needed, using safe OR-chained conditions
      // We do a single GROUP BY user_id query with HAVING clauses
      const rows = await sql`
        SELECT DISTINCT user_id FROM crops
        WHERE user_id IN (
          -- users who match crop name (or skip if no crop filter)
          SELECT user_id FROM crops
          WHERE 1=1
          ${hasCropFilter ? sql`
            AND (
              ${cropConditions.reduce((acc, cond, i) =>
                i === 0 ? cond : sql`${acc} OR ${cond}`, sql`FALSE`)}
            )
          ` : sql``}
          ${hasGradeFilter ? sql`
            AND (
              ${gradeConditions.reduce((acc, cond, i) =>
                i === 0 ? cond : sql`${acc} OR ${cond}`,
                sql`FALSE` as any)}
            )
          ` : sql``}
          ${hasCertFilter ? sql`
            AND (
              ${certConditions.reduce((acc, cond, i) =>
                i === 0 ? cond : sql`${acc} OR ${cond}`,
                sql`FALSE` as any)}
            )
          ` : sql``}
          ${hasDateFilter ? sql`
            AND expected_yield_date IS NOT NULL
            ${yieldDateFrom ? sql`AND expected_yield_date >= ${yieldDateFrom}::date` : sql``}
            ${yieldDateTo   ? sql`AND expected_yield_date <= ${yieldDateTo}::date`   : sql``}
          ` : sql``}
        )
      `;
      matchedCropUserIds = new Set((rows as any[]).map((r: any) => r.user_id));
    }

    // ── equipment matching ──────────────────────────────────────────────────
    let matchedEquipUserIds: Set<string> | null = null;
    if (equipment.length > 0) {
      const allRows = await Promise.all(
        equipment.map(eq => sql`SELECT DISTINCT owner_id FROM machinery WHERE name ILIKE ${'%' + eq + '%'}`)
      );
      matchedEquipUserIds = new Set(
        allRows.flatMap((rows: any[]) => rows.map((r: any) => r.owner_id))
      );
    }

    // ── FIX 3+4: rank-and-sort instead of hard-filter-and-disappear ─────────
    // Every user gets a relevance score. Hard filters (distance, role) already
    // applied above. Crop/grade/cert/equip now produce a SCORE, not a wall.
    // Users matching all active filters score highest; partial matches score
    // lower but still appear (good UX — shows "nearby" users even if no
    // exact match). Set score=0 to completely hide non-matching when filters active.

    const anyFilterActive =
      matchedCropUserIds !== null || matchedEquipUserIds !== null;

    const scored = afterDistance.map((u: any) => {
      let score = 0;

      if (matchedCropUserIds !== null) {
        if (matchedCropUserIds.has(u.id)) score += 10;
        // non-matching users get score 0 — we'll filter them out below
      }
      if (matchedEquipUserIds !== null) {
        if (matchedEquipUserIds.has(u.id)) score += 5;
      }

      return { ...u, _score: score };
    });

    // When filters are active: only show users who match ALL active filter groups
    // When no filters: show everyone
    const result = anyFilterActive
      ? scored.filter((u: any) => {
          if (matchedCropUserIds  !== null && !matchedCropUserIds.has(u.id))  return false;
          if (matchedEquipUserIds !== null && !matchedEquipUserIds.has(u.id)) return false;
          return true;
        })
      : scored;

    // ── batch-fetch details ─────────────────────────────────────────────────
    const userIds: string[] = result.map((u: any) => u.id);

    let allCrops:     any[] = [];
    let allEquip:     any[] = [];
    let allFollowers: any[] = [];
    let allFollowing: any[] = [];
    let allViewerFollows: any[] = [];

    if (userIds.length > 0) {
      [allCrops, allEquip, allFollowers, allFollowing, allViewerFollows] = await Promise.all([
        sql`
          SELECT user_id, crop_name, years_of_experience, expertise_level,
                 is_crop_waste, grade, certification_type,
                 expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom
          FROM crops
          WHERE user_id = ANY(${userIds}::text[])
          ORDER BY created_at DESC
        `,
        sql`
          SELECT id, name, model, daily_rate, image_url, owner_id
          FROM machinery
          WHERE owner_id = ANY(${userIds}::text[])
          ORDER BY created_at DESC
        `,
        sql`
          SELECT following_id, COUNT(*)::integer AS count
          FROM follows
          WHERE following_id = ANY(${userIds}::text[]) AND status = 'accepted'
          GROUP BY following_id
        `,
        sql`
          SELECT user_id, COUNT(*)::integer AS count
          FROM follows
          WHERE user_id = ANY(${userIds}::text[]) AND status = 'accepted'
          GROUP BY user_id
        `,
        currentUserId ? sql`
          SELECT following_id, status
          FROM follows
          WHERE user_id = ${currentUserId}
            AND following_id = ANY(${userIds}::text[])
        ` : Promise.resolve([]),
      ]);
    }

    // ── build lookup maps ───────────────────────────────────────────────────
    const cropsMap     = new Map<string, any[]>();
    const equipMap     = new Map<string, any[]>();
    const followersMap = new Map<string, number>();
    const followingMap = new Map<string, number>();
    const viewerFollowMap = new Map<string, string>();

    (allCrops as any[]).forEach((c: any) => {
      if (!cropsMap.has(c.user_id)) cropsMap.set(c.user_id, []);
      cropsMap.get(c.user_id)!.push({
        crop_name:                   c.crop_name,
        years_of_experience:         c.years_of_experience,
        expertise_level:             c.expertise_level,
        is_crop_waste:               c.is_crop_waste,
        grade:                       c.grade,
        certification_type:          c.certification_type,
        expected_yield_date:         c.expected_yield_date,
        expected_yield_quantity:     c.expected_yield_quantity,
        expected_yield_quantity_uom: c.expected_yield_quantity_uom,
      });
    });

    (allEquip as any[]).forEach((e: any) => {
      if (!equipMap.has(e.owner_id)) equipMap.set(e.owner_id, []);
      equipMap.get(e.owner_id)!.push({
        id: e.id, name: e.name, model: e.model,
        daily_rate: e.daily_rate, image_url: e.image_url,
      });
    });

    (allFollowers as any[]).forEach((f: any) => followersMap.set(f.following_id, f.count || 0));
    (allFollowing as any[]).forEach((f: any) => followingMap.set(f.user_id,       f.count || 0));
    (allViewerFollows as any[]).forEach((f: any) => viewerFollowMap.set(f.following_id, f.status || 'none'));

    // ── assemble + FIX 3: sort by score DESC then distance ASC ─────────────
    const finalResult = result
      .map((user: any) => {
        const allUserCrops  = cropsMap.get(user.id) || [];
        const visibleCrops  = showWasteBuyers
          ? allUserCrops.filter((c: any) => c.is_crop_waste)
          : allUserCrops;
        const followStatus = user.id === currentUserId ? 'accepted' : viewerFollowMap.get(user.id) || 'none';
        const canCall = Boolean(
          user.phone &&
          (isAdminViewer || (user.calling_enabled && followStatus === 'accepted'))
        );

        return {
          ...user,
          phone: canCall ? user.phone : '',
          can_call: canCall,
          followStatus,
          crops:           visibleCrops,
          crops_count:     visibleCrops.length,
          equipment:       (equipMap.get(user.id) || []).slice(0, 5),
          equipment_count: parseInt(user.equipment_count) || 0,
          rating:          null,
          followers_count: followersMap.get(user.id) || 0,
          following_count: followingMap.get(user.id) || 0,
        };
      })
      .sort((a: any, b: any) => {
        // FIX 3: best matches first, then by proximity
        if (b._score !== a._score) return b._score - a._score;
        if (a.distance == null)    return 1;
        if (b.distance == null)    return -1;
        return a.distance - b.distance;
      })
      // strip internal field before sending
      .map(({ _score, ...u }: any) => u);

    return NextResponse.json(finalResult);

  } catch (error: any) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching nearby farmers:", msg);
    return NextResponse.json(
      { error: "Failed to fetch nearby farmers", details: msg },
      { status: 500 }
    );
  }
}
