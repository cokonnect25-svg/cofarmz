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
    const searchType = searchParams.get("type") || "farmers"; // "farmers" or "buyers"
    const showWasteBuyers = searchParams.get("wasteOnly") === "true";
    const currentUserId = searchParams.get("currentUserId");

    // Ensure lat/lon columns exist
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION`.catch(() => { });
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION`.catch(() => { });

    // Allow 0,0 fallback — just means distance will be 9999 (sorted last)

    // Determine role value based on searchType
    const targetRole = searchType === "farmers" ? 'farmer' : 'buyer';

    // Get all farmers/buyers — try u.role directly first, fallback to roles JOIN
    let farmers: any[];
    try {
      farmers = await sql`
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
        WHERE u.role = ${targetRole}
          ${currentUserId ? sql`AND u.id != ${currentUserId}` : sql``}
        GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, u.role
      `;
    } catch {
      // Fallback: role column may not exist — use roles JOIN
      farmers = await sql`
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
        WHERE (r.name = ${targetRole} OR u.role_id = ${targetRole === 'farmer' ? 1 : 2})
          ${currentUserId ? sql`AND u.id != ${currentUserId}` : sql``}
        GROUP BY u.id, u.name, u.email, u.image, u.latitude, u.longitude, u.location, u.phone, r.name
      `;
    }

    // Calculate distance for all farmers (Haversine formula)
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const R = 6371; // Earth's radius in km
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

    // If user location is (0,0) or missing, treat as no location — all distances unknown
    const userHasLocation = latitude !== 0 || longitude !== 0;

    // Map farmers with calculated distance (null lat/lon gets distance = 9999 so they sort last)
    const farmersWithDistance = (farmers as any[]).map((farmer: any) => ({
      ...farmer,
      distance: (userHasLocation && farmer.latitude != null && farmer.longitude != null)
        ? calculateDistance(latitude, longitude, parseFloat(farmer.latitude), parseFloat(farmer.longitude))
        : 9999
    }));

    // Filter by distance if enabled (only applies to users with actual location)
    const filteredByDistance = distance !== null
      ? farmersWithDistance.filter((farmer: any) => farmer.distance <= distance || farmer.distance === 9999)
      : farmersWithDistance;

    // Filter by minimum rating (skip for now since rating column doesn't exist in reservations)
    const filteredByRating = filteredByDistance;

    // Get farmer/buyer IDs that match crop filter
    // Note: crop_type is no longer used for filtering — role (farmer/buyer) already distinguishes intent
    let farmerWithCropsIds: string[] = [];
    if (crops.length > 0 || showWasteBuyers) {
      if (showWasteBuyers && searchType === "buyers") {
        // Get buyers who buy crop waste
        const wasteBuyers = await sql`
          SELECT DISTINCT c.user_id
          FROM crops c
          JOIN "user" u ON c.user_id = u.id
          WHERE c.is_crop_waste = true AND u.role = 'buyer'
        `;
        farmerWithCropsIds = (wasteBuyers as any[]).map((row: any) => row.user_id);
      } else if (crops.length > 0) {
        // Match by crop_name only — role filter on user already handles buyer/farmer distinction
        const farmersWithCrops = await sql`
          SELECT DISTINCT user_id
          FROM crops
          WHERE LOWER(crop_name) = LOWER(${crops[0]})
          ${yieldDateFrom || yieldDateTo ? sql`AND expected_yield_date IS NOT NULL` : sql``}
          ${yieldDateFrom && yieldDateTo ? sql`AND expected_yield_date BETWEEN ${yieldDateFrom}::date AND ${yieldDateTo}::date` :
            yieldDateFrom ? sql`AND expected_yield_date >= ${yieldDateFrom}::date` :
              yieldDateTo ? sql`AND expected_yield_date <= ${yieldDateTo}::date` : sql``}
        `;
        farmerWithCropsIds = (farmersWithCrops as any[]).map((row: any) => row.user_id);

        // If multiple crops, include users with any of those crops
        if (crops.length > 1) {
          for (let i = 1; i < crops.length; i++) {
            const moreFarmers = await sql`
              SELECT DISTINCT user_id
              FROM crops
              WHERE LOWER(crop_name) = LOWER(${crops[i]})
              ${yieldDateFrom || yieldDateTo ? sql`AND expected_yield_date IS NOT NULL` : sql``}
              ${yieldDateFrom && yieldDateTo ? sql`AND expected_yield_date BETWEEN ${yieldDateFrom}::date AND ${yieldDateTo}::date` :
                yieldDateFrom ? sql`AND expected_yield_date >= ${yieldDateFrom}::date` :
                  yieldDateTo ? sql`AND expected_yield_date <= ${yieldDateTo}::date` : sql``}
            `;
            const moreIds = (moreFarmers as any[]).map((row: any) => row.user_id);
            farmerWithCropsIds = [...new Set([...farmerWithCropsIds, ...moreIds])];
          }
        }
      }
    }

    // Get farmer IDs that match equipment filter
    let farmerWithEquipmentIds: string[] = [];
    if (equipment.length > 0) {
      const farmersWithEquipment = await sql`
        SELECT DISTINCT owner_id 
        FROM machinery 
        WHERE name ILIKE ${`%${equipment[0]}%`}
      `;
      farmerWithEquipmentIds = (farmersWithEquipment as any[]).map((row: any) => row.owner_id);

      // If multiple equipment selected, include farmers with any of those equipment
      if (equipment.length > 1) {
        for (let i = 1; i < equipment.length; i++) {
          const moreEquipment = await sql`
            SELECT DISTINCT owner_id 
            FROM machinery 
            WHERE name ILIKE ${`%${equipment[i]}%`}
          `;
          const moreIds = (moreEquipment as any[]).map((row: any) => row.owner_id);
          farmerWithEquipmentIds = [...new Set([...farmerWithEquipmentIds, ...moreIds])];
        }
      }
    }

    // Apply crop and equipment filters
    let result = filteredByRating;
    if (crops.length > 0 || showWasteBuyers) {
      result = result.filter((farmer: any) => farmerWithCropsIds.includes(farmer.id));
    }
    if (equipment.length > 0) {
      result = result.filter((farmer: any) => farmerWithEquipmentIds.includes(farmer.id));
    }

    // Fetch all necessary data in 4 batch queries (no loops)
    const farmerIds = result.map((f: any) => f.id);

    let allCrops: any[] = [];
    let allEquipment: any[] = [];
    let allFollowers: any[] = [];
    let allFollowing: any[] = [];

    if (farmerIds.length > 0) {
      [allCrops, allEquipment, allFollowers, allFollowing] = await Promise.all([
        sql`
          SELECT user_id, crop_name, years_of_experience, expertise_level, is_crop_waste
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

    // Create lookup maps
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
        is_crop_waste: crop.is_crop_waste
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

    // Build farmers with details
    const farmersWithDetails = result.map((farmer: any) => {
      const crops = cropsMap.get(farmer.id) || [];
      const equipment = (equipmentMap.get(farmer.id) || []).slice(0, 5);
      return {
        ...farmer,
        crops: crops,
        crops_count: crops.length,
        equipment: equipment,
        equipment_count: parseInt(farmer.equipment_count) || 0,
        rating: null,
        followers_count: followersMap.get(farmer.id) || 0,
        following_count: followingMap.get(farmer.id) || 0
      };
    });

    // Sort by distance
    farmersWithDetails.sort((a: any, b: any) => a.distance - b.distance);

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
