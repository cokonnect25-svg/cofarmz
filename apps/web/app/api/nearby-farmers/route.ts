export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude    = parseFloat(searchParams.get("latitude")  || "0");
    const longitude   = parseFloat(searchParams.get("longitude") || "0");
    const distance    = searchParams.get("distance") ? parseInt(searchParams.get("distance") || "50") : null;
    const minRating   = parseFloat(searchParams.get("minRating") || "0");

    const crops = (searchParams.get("crops")?.split(",").filter(Boolean) ?? [])
      .map(c => c.trim().toLowerCase());

    const grades = (searchParams.get("grades")?.split(",").filter(Boolean) ?? [])
      .map(g => g.trim().toLowerCase());

    const certTypes = (searchParams.get("certTypes")?.split(",").filter(Boolean) ?? [])
      .map(c => c.trim().toLowerCase());

    // BUG FIX A: normalise all filter arrays — trim + lowercase ready for comparison
    const equipment  = (searchParams.get("equipment") ?.split(",").filter(Boolean) ?? []);

    const yieldDateFrom  = searchParams.get("yieldDateFrom") || null;
    const yieldDateTo    = searchParams.get("yieldDateTo")   || null;
    const searchType     = searchParams.get("type") || "farmers";
    const showWasteBuyers = searchParams.get("wasteOnly") === "true";
    const currentUserId  = searchParams.get("currentUserId");

    // Ensure required columns exist
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone    TEXT`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {});

    const targetRole =
      searchType === "farmers"  ? "farmer"  :
      searchType === "supplier" ? "supplier" :
      "buyer";

    // Fetch all users matching the target role
    const users = await sql`
      SELECT
        u.id, u.name, u.email,
        COALESCE(u.image, 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || u.id) AS image,
        u.latitude, u.longitude,
        COALESCE(u.location, '')  AS location,
        COALESCE(u.phone,    '')  AS phone,
        COALESCE(u.role, 'buyer') AS role,
        COUNT(DISTINCT m.id)      AS equipment_count
      FROM "user" u
      LEFT JOIN machinery m ON u.id = m.owner_id
      WHERE (
        u.role = ${targetRole}
        OR (u.role IS NULL AND u.role_id = ${
          targetRole === "farmer"   ? 1 :
          targetRole === "supplier" ? 3 : 2
        })
      )
      ${currentUserId ? sql`AND u.id != ${currentUserId}` : sql``}
      GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, u.role
    `;

    // ── Haversine distance ────────────────────────────────────────────────────
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

    // BUG FIX B: distance filter must EXCLUDE users without location when filter is on
    const filteredByDistance =
      distance !== null
        ? usersWithDist.filter((u: any) => u.distance == null || u.distance <= distance)
        : usersWithDist;

    // ── Crop / grade / cert / date / waste filtering ──────────────────────────
    const hasCropFilter  = crops.length     > 0;
    const hasGradeFilter = grades.length    > 0;
    const hasCertFilter  = certTypes.length > 0;
    const hasDateFilter  = !!(yieldDateFrom || yieldDateTo);

    // null  = filter not active (show everyone)
    // array = only show users whose id is in this array
// 🚀 NEW: USER-LEVEL FILTERING (correct logic)



      let matchedCropUserIds: string[] | null = null;

      if (hasCropFilter || hasGradeFilter || hasCertFilter || hasDateFilter) {

        const rows = await sql`
          SELECT user_id
          FROM crops
          GROUP BY user_id
          HAVING

            -- 🌾 Crop filter
            ${hasCropFilter
              ? sql`
                BOOL_OR(
                  crop_name IS NOT NULL AND
                  LOWER(TRIM(crop_name)) ILIKE ANY (ARRAY[
                    ${sql.join(crops.map(c => `%${c}%`), sql`, `)}
                  ])
                )
              `
              : sql`TRUE`}

            AND

            -- 🏷️ Grade filter (FIXED)
            ${hasGradeFilter
              ? sql`
                BOOL_OR(
                  grade IS NOT NULL AND
                  LOWER(TRIM(grade)) ILIKE ANY (ARRAY[
                    ${sql.join(grades.map(g => `%${g}%`), sql`, `)}
                  ])
                )
              `
              : sql`TRUE`}

            AND

            -- 🌿 Certification filter (FIXED)
            ${hasCertFilter
              ? sql`
                BOOL_OR(
                  certification_type IS NOT NULL AND
                  LOWER(TRIM(certification_type)) ILIKE ANY (ARRAY[
                    ${sql.join(certTypes.map(c => `%${c}%`), sql`, `)}
                  ])
                )
              `
              : sql`TRUE`}

            AND

            -- 📅 Date filter
            ${hasDateFilter
              ? sql`
                BOOL_OR(
                  expected_yield_date IS NOT NULL
                  AND (
                    (${yieldDateFrom ? sql`expected_yield_date >= ${yieldDateFrom}::date` : sql`TRUE`})
                    AND
                    (${yieldDateTo ? sql`expected_yield_date <= ${yieldDateTo}::date` : sql`TRUE`})
                  )
                )
              `
              : sql`TRUE`}
        `;

        matchedCropUserIds = rows.map((r: any) => r.user_id);
      }

    // ── Equipment filtering ───────────────────────────────────────────────────
    let matchedEquipUserIds: string[] | null = null;
    if (equipment.length > 0) {
      const allRows = await Promise.all(
        equipment.map(eq =>
          sql`SELECT DISTINCT owner_id FROM machinery WHERE name ILIKE ${`%${eq}%`}`
        )
      );
const ids = allRows.flatMap(rows => rows.map(r => r.owner_id));
matchedEquipUserIds = [...new Set(ids)];
    }

    // ── Apply JS-side filters ─────────────────────────────────────────────────
    let result = filteredByDistance;

if (matchedCropUserIds !== null) {
  console.log("Matched Users:", matchedCropUserIds.length);
  result = result.filter((u: any) => matchedCropUserIds.includes(u.id));
}
    if (matchedEquipUserIds !== null) {
      result = result.filter((u: any) => matchedEquipUserIds!.includes(u.id));
    }

    // ── Batch-fetch details for matched users ─────────────────────────────────
    const userIds = result.map((u: any) => u.id);

    let allCrops:     any[] = [];
    let allEquip:     any[] = [];
    let allFollowers: any[] = [];
    let allFollowing: any[] = [];

    if (userIds.length > 0) {
      [allCrops, allEquip, allFollowers, allFollowing] = await Promise.all([
        sql`
          SELECT
            user_id, crop_name, years_of_experience, expertise_level,
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
          WHERE following_id = ANY(${userIds}::text[])
          GROUP BY following_id
        `,
        sql`
          SELECT user_id, COUNT(*)::integer AS count
          FROM follows
          WHERE user_id = ANY(${userIds}::text[])
          GROUP BY user_id
        `,
      ]);
    }

    // ── Build lookup maps ─────────────────────────────────────────────────────
    const cropsMap     = new Map<string, any[]>();
    const equipMap     = new Map<string, any[]>();
    const followersMap = new Map<string, number>();
    const followingMap = new Map<string, number>();

    (allCrops as any[]).forEach((c: any) => {
      if (!cropsMap.has(c.user_id)) cropsMap.set(c.user_id, []);
      cropsMap.get(c.user_id)!.push({
        crop_name:           c.crop_name,
        years_of_experience: c.years_of_experience,
        expertise_level:     c.expertise_level,
        is_crop_waste:       c.is_crop_waste,

        grade:               c.grade,
        certification_type:  c.certification_type,
        expected_yield_date:     c.expected_yield_date,
        expected_yield_quantity: c.expected_yield_quantity,
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

    // ── Assemble final response ───────────────────────────────────────────────
    const finalResult = result.map((user: any) => {
      const allUserCrops = cropsMap.get(user.id) || [];

      // For wastage search only surface waste crops in the card tags
      const visibleCrops = showWasteBuyers
        ? allUserCrops.filter((c: any) => c.is_crop_waste)
        : allUserCrops;

      return {
        ...user,
        crops:           visibleCrops,
        crops_count:     visibleCrops.length,
        equipment:       (equipMap.get(user.id) || []).slice(0, 5),
        equipment_count: parseInt(user.equipment_count) || 0,
        rating:          null,
        followers_count: followersMap.get(user.id) || 0,
        following_count: followingMap.get(user.id) || 0,
      };
    });

    // Sort: users with known distance first, ascending
    finalResult.sort((a: any, b: any) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });

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