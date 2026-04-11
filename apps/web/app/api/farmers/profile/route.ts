import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const farmerId = searchParams.get("farmerId") || searchParams.get("userId") || searchParams.get("id");
    const tab = searchParams.get("tab");
    const currentUserId = request.headers.get("x-user-id");

    if (!farmerId) {
      return NextResponse.json({ error: "Missing farmerId" }, { status: 400 });
    }

    // Fetch farmer profile with role information
    const farmers = await sql`
      SELECT
        u.id, u.name, u.email, u.phone, u.image, u.location,
        u.latitude, u.longitude,
        COALESCE(u.role, r.name) as role,
        r.display_name as role_display_name,
        r.permissions as role_permissions
      FROM "user" u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ${farmerId}
      LIMIT 1
    `;

    if (!farmers || farmers.length === 0) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const farmer = farmers[0];
    
    // Get counts
    let followers_count = 0;
    let following_count = 0;
    let crops_count = 0;
    let equipments_count = 0;
    let crops: any[] = [];
    let equipment: any[] = [];
    let followers: any[] = [];
    let following: any[] = [];

    try {
      const result = await sql`SELECT COUNT(*) as count FROM follows WHERE following_id = ${farmerId}`;
      followers_count = parseInt(String(result?.[0]?.count || 0));
    } catch (e) {
      console.error("Error counting followers:", e);
    }

    try {
      const result = await sql`SELECT COUNT(*) as count FROM follows WHERE user_id = ${farmerId}`;
      following_count = parseInt(String(result?.[0]?.count || 0));
    } catch (e) {
      console.error("Error counting following:", e);
    }

    try {
      const result = await sql`SELECT COUNT(*) as count FROM crops WHERE user_id = ${farmerId}`;
      crops_count = parseInt(String(result?.[0]?.count || 0));
    } catch (e) {
      console.error("Error counting crops:", e);
    }

    try {
      const result = await sql`SELECT COUNT(*) as count FROM machinery WHERE owner_id = ${farmerId}`;
      equipments_count = parseInt(String(result?.[0]?.count || 0));
    } catch (e) {
      console.error("Error counting equipment:", e);
    }

    // Always fetch all data (followers, following, crops, equipment)
    // This ensures data is available when sections are clicked
    try {
      followers = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.user_id = u.id
        WHERE f.following_id = ${farmerId}
        ORDER BY f.created_at DESC
      `;
    } catch (e) {
      console.error("Error fetching followers:", e);
      followers = [];
    }

    try {
      following = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.following_id = u.id
        WHERE f.user_id = ${farmerId}
        ORDER BY f.created_at DESC
      `;
    } catch (e) {
      console.error("Error fetching following:", e);
      following = [];
    }

    try {
      crops = await sql`SELECT crop_name, years_of_experience, expertise_level FROM crops WHERE user_id = ${farmerId} LIMIT 50`;
    } catch (e) {
      console.error("Error fetching crops:", e);
      crops = [];
    }

    try {
      equipment = await sql`SELECT id, name, model, daily_rate, image_url FROM machinery WHERE owner_id = ${farmerId} LIMIT 50`;
    } catch (e) {
      console.error("Error fetching equipment:", e);
      equipment = [];
    }

    // Fetch user's reels
    let reels: any[] = [];
    try {
      reels = await sql`
        SELECT 
          r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
          (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.id) as likes,
          (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) as comments
        FROM reels r
        WHERE r.user_id = ${farmerId}
        ORDER BY r.created_at DESC
        LIMIT 50
      `;

      // Add is_liked status if current user is logged in
      if (currentUserId) {
        reels = await Promise.all(reels.map(async (reel) => {
          try {
            const likeCheck = await sql`SELECT COUNT(*) as count FROM reel_likes WHERE reel_id = ${reel.id} AND user_id = ${currentUserId}`;
            return {
              ...reel,
              is_liked: parseInt(String(likeCheck?.[0]?.count || 0)) > 0
            };
          } catch (e) {
            return { ...reel, is_liked: false };
          }
        }));
      }
    } catch (e) {
      console.error("Error fetching reels:", e);
      reels = [];
    }

    // Check if current user is following this farmer
    let isFollowing = false;
    if (currentUserId && currentUserId !== farmerId) {
      try {
        const followCheck = await sql`SELECT COUNT(*) as count FROM follows WHERE user_id = ${currentUserId} AND following_id = ${farmerId}`;
        isFollowing = parseInt(String(followCheck?.[0]?.count || 0)) > 0;
      } catch (e) {
        console.error("Error checking follow status:", e);
      }
    }

    // Reverse geocode if location text is missing but lat/lon exist
    let locationText = farmer.location || "";
    if (!locationText && farmer.latitude && farmer.longitude) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${farmer.latitude}&lon=${farmer.longitude}&zoom=10`,
          { headers: { 'User-Agent': 'CoFarmz/1.0' } }
        );
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          const addr = geoData.address || {};
          locationText = [addr.suburb || addr.village || addr.town, addr.city || addr.county, addr.state]
            .filter(Boolean).join(', ');
        }
      } catch (e) {
        // ignore geocode errors
      }
    }

    const response = {
      id: farmer.id,
      name: farmer.name,
      email: farmer.email,
      phone: farmer.phone || null,
      image: farmer.image || null,
      location: locationText,
      latitude: farmer.latitude ? parseFloat(farmer.latitude) : null,
      longitude: farmer.longitude ? parseFloat(farmer.longitude) : null,
      role: farmer.role || 'buyer',
      followers_count,
      following_count,
      crops_count,
      equipments_count,
      crops: Array.isArray(crops) ? crops : [],
      equipment: Array.isArray(equipment) ? equipment : [],
      followers: Array.isArray(followers) ? followers : [],
      following: Array.isArray(following) ? following : [],
      reels: Array.isArray(reels) ? reels : [],
      isFollowing
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error("Farmer profile error:", error);
    return NextResponse.json(
      { error: "Failed to get farmer profile", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
