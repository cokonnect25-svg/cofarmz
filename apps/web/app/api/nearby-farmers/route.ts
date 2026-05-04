export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const latitude = parseFloat(searchParams.get("latitude") || "0");
    const longitude = parseFloat(searchParams.get("longitude") || "0");
    const distance = searchParams.get("distance") ? parseInt(searchParams.get("distance") || "50") : null;
    const minRating = parseFloat(searchParams.get("minRating") || "0");
    const crops = searchParams.get("crops")?.split(",").filter(Boolean) || [];
    const equipment = searchParams.get("equipment")?.split(",").filter(Boolean) || [];
    const yieldDateFrom = searchParams.get("yieldDateFrom") || null;
    const yieldDateTo = searchParams.get("yieldDateTo") || null;
    const searchType = searchParams.get("type") || "farmers";
    const showWasteBuyers = searchParams.get("wasteOnly") === "true";
    const currentUserId = searchParams.get("currentUserId");
    const grades = searchParams.get("grades")?.split(",").filter(Boolean) || [];
    const certTypes = searchParams.get("certTypes")?.split(",").filter(Boolean) || [];

    // Ensure required columns exist
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'buyer'`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS phone TEXT`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => { });

    const targetRole =
      searchType === "farmers" ? 'farmer' :
      searchType === "supplier" ? 'supplier' :
      'buyer';

    const farmers = await sql`
      SELECT
        u.id, u.name, u.email,
        COALESCE(u.image, 'https://api.dicebear.com/7.x/avataaars/svg?seed=' || u.id) as image,
        u.latitude, u.longitude,
        COALESCE(u.location, '') as location,
        COALESCE(u.phone, '') as phone,
        COALESCE(u.role, 'buyer') as role,
        COUNT(DISTINCT m.id) as equipment_count
      FROM "user" u
      LEFT JOIN machinery m ON u.id = m.owner_id
      WHERE (
        u.role = ${targetRole}
        OR (u.role IS NULL AND u.role_id = ${
          targetRole === 'farmer' ? 1 :
          targetRole === 'supplier' ? 3 :
          2
        })
      )
      ${currentUserId ? sql`AND u.id != ${currentUserId}` : sql``}
      GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, u.role
    `;

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const userHasLocation = latitude !== 0 || longitude !== 0;

    const farmersWithDistance = (farmers as any[]).map((farmer: any) => ({
      ...farmer,
      distance: (userHasLocation && farmer.latitude != null && farmer.longitude != null)
        ? calculateDistance(latitude, longitude, parseFloat(farmer.latitude), parseFloat(farmer.longitude))
        : null
    }));

    // BUG FIX 4: Exclude null-distance users when distance filter is active
    const filteredByDistance = distance !== null
      ? farmersWithDistance.filter((farmer: any) => farmer.distance != null && farmer.distance <= distance)
      : farmersWithDistance;

    const filteredByRating = filteredByDistance;

    // BUG FIX 2+3: Date filter + grade/cert filter all unified into one crop-matching query
    // This runs whenever ANY of: crops, dates, grades, certTypes are set
    const hasCropFilter = crops.length > 0;
    const hasDateFilter = yieldDateFrom || yieldDateTo;
    const hasGradeFilter = grades.length > 0;
    const hasCertFilter = certTypes.length > 0;

    let farmerWithCropsIds: string[] | null = null; // null = no filter applied

    if (showWasteBuyers || searchType === "wastage") {
      const wasteBuyers = await sql`
        SELECT DISTINCT c.user_id
        FROM crops c
        JOIN "user" u ON c.user_id = u.id
        WHERE c.is_crop_waste = true AND u.role = 'buyer'
      `;
      farmerWithCropsIds = (wasteBuyers as any[]).map((row: any) => row.user_id);
    } else if (hasCropFilter || hasDateFilter || hasGradeFilter || hasCertFilter) {
      // BUG FIX 2: Date filter now runs independently of crop name filter
      // BUG FIX 3: Grade/cert unified into a single query to avoid split-filter ID mismatch
      const matchingCrops = await sql`
        SELECT DISTINCT user_id
        FROM crops
        WHERE 1=1
        ${hasCropFilter ? sql`AND LOWER(crop_name) IN (${sql.join(crops.map(c => c.toLowerCase()), sql`, `)})` : sql``}
        ${hasDateFilter ? sql`AND expected_yield_date IS NOT NULL` : sql``}
        ${yieldDateFrom && yieldDateTo
          ? sql`AND expected_yield_date BETWEEN ${yieldDateFrom}::date AND ${yieldDateTo}::date`
          : yieldDateFrom
          ? sql`AND expected_yield_date >= ${yieldDateFrom}::date`
          : yieldDateTo
          ? sql`AND expected_yield_date <= ${yieldDateTo}::date`
          : sql``}
        ${hasGradeFilter ? sql`AND LOWER(COALESCE(grade, '')) IN (${sql.join(grades.map(g => g.toLowerCase()), sql`, `)})` : sql``}
        ${hasCertFilter ? sql`AND LOWER(COALESCE(certification_type, '')) IN (${sql.join(certTypes.map(c => c.toLowerCase()), sql`, `)})` : sql``}
      `;
      farmerWithCropsIds = (matchingCrops as any[]).map((row: any) => row.user_id);
    }

    let farmerWithEquipmentIds: string[] | null = null;
    if (equipment.length > 0) {
      const allEquipMatches = await Promise.all(
        equipment.map(eq => sql`SELECT DISTINCT owner_id FROM machinery WHERE name ILIKE ${`%${eq}%`}`)
      );
      const ids = allEquipMatches.flatMap((rows: any[]) => rows.map((r: any) => r.owner_id));
      farmerWithEquipmentIds = [...new Set(ids)];
    }

    let result = filteredByRating;
    if (farmerWithCropsIds !== null) {
      result = result.filter((farmer: any) => farmerWithCropsIds!.includes(farmer.id));
    }
    if (farmerWithEquipmentIds !== null) {
      result = result.filter((farmer: any) => farmerWithEquipmentIds!.includes(farmer.id));
    }

    const farmerIds = result.map((f: any) => f.id);

    let allCrops: any[] = [];
    let allEquipment: any[] = [];
    let allFollowers: any[] = [];
    let allFollowing: any[] = [];

    if (farmerIds.length > 0) {
      [allCrops, allEquipment, allFollowers, allFollowing] = await Promise.all([
        sql`
          SELECT user_id, crop_name, years_of_experience, expertise_level, is_crop_waste, grade, certification_type
          FROM crops
          WHERE user_id = ANY(${farmerIds}::text[])
          ORDER BY created_at DESC
        `,
        sql`
          SELECT id, name, model, daily_rate, image_url, owner_id
          FROM machinery
          WHERE owner_id = ANY(${farmerIds}::text[])
          ORDER BY created_at DESC
        `,
        sql`
          SELECT following_id, COUNT(*)::integer as count
          FROM follows
          WHERE following_id = ANY(${farmerIds}::text[])
          GROUP BY following_id
        `,
        sql`
          SELECT user_id, COUNT(*)::integer as count
          FROM follows
          WHERE user_id = ANY(${farmerIds}::text[])
          GROUP BY user_id
        `,
      ]);
    }

    const cropsMap = new Map();
    const equipmentMap = new Map();
    const followersMap = new Map();
    const followingMap = new Map();

    (allCrops as any[]).forEach((crop: any) => {
      if (!cropsMap.has(crop.user_id)) cropsMap.set(crop.user_id, []);
      cropsMap.get(crop.user_id).push({
        crop_name: crop.crop_name,
        years_of_experience: crop.years_of_experience,
        expertise_level: crop.expertise_level,
        is_crop_waste: crop.is_crop_waste,
        // BUG FIX 1: grade and certification_type were fetched but never included in the map
        grade: crop.grade,
        certification_type: crop.certification_type,
      });
    });

    (allEquipment as any[]).forEach((equip: any) => {
      if (!equipmentMap.has(equip.owner_id)) equipmentMap.set(equip.owner_id, []);
      equipmentMap.get(equip.owner_id).push({
        id: equip.id,
        name: equip.name,
        model: equip.model,
        daily_rate: equip.daily_rate,
        image_url: equip.image_url
      });
    });

    (allFollowers as any[]).forEach((f: any) => {
      followersMap.set(f.following_id, f.count || 0);
    });

    (allFollowing as any[]).forEach((f: any) => {
      followingMap.set(f.user_id, f.count || 0);
    });

    const farmersWithDetails = result.map((farmer: any) => {
      const allFarmerCrops = cropsMap.get(farmer.id) || [];
      const equipment = (equipmentMap.get(farmer.id) || []).slice(0, 5);

      const cropsFiltered = showWasteBuyers
        ? allFarmerCrops.filter((c: any) => c.is_crop_waste)
        : allFarmerCrops;

      return {
        ...farmer,
        crops: cropsFiltered,
        crops_count: cropsFiltered.length,
        equipment,
        equipment_count: parseInt(farmer.equipment_count) || 0,
        rating: null,
        followers_count: followersMap.get(farmer.id) || 0,
        following_count: followingMap.get(farmer.id) || 0,
      };
    });

    farmersWithDetails.sort((a, b) => {
      if (a.distance == null) return 1;
      if (b.distance == null) return -1;
      return a.distance - b.distance;
    });

    return NextResponse.json(farmersWithDetails);
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error fetching nearby farmers:", errorMsg);
    return NextResponse.json(
      { error: "Failed to fetch nearby farmers", details: errorMsg },
      { status: 500 }
    );
  }
}