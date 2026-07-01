export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

function isAdminRole(row: any) {
  const role = String(row?.role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const displayName = String(row?.role_display_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return role === 'admin' || role === 'superadmin' || displayName === 'admin' || displayName === 'superadmin' || Number(row?.role_id) === 5;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const farmerId = searchParams.get("farmerId") || searchParams.get("userId") || searchParams.get("id");
    const currentUserId = request.headers.get("x-user-id") || searchParams.get("currentUserId");

    if (!farmerId) {
      return NextResponse.json({ error: "Missing farmerId" }, { status: 400 });
    }

    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS supplier_types TEXT[] DEFAULT ARRAY[]::TEXT[]`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS calling_enabled BOOLEAN DEFAULT true`.catch(() => {});
    await sql`ALTER TABLE "user" ADD COLUMN IF NOT EXISTS bio TEXT`.catch(() => {});

    // ── Core profile ────────────────────────────────────────────────────────
    const farmers = await sql`
      SELECT
        u.id, u.name, u.email, u.phone, u.image, u.location, u.bio,
        u.latitude, u.longitude,
        COALESCE(u.calling_enabled, true) as calling_enabled,
        COALESCE(u.role, r.name) as role,
        COALESCE(u.supplier_types, ARRAY[]::text[]) as supplier_types,
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

    // ── Counts ───────────────────────────────────────────────────────────────
    let followers_count = 0, following_count = 0, crops_count = 0, equipments_count = 0;

    try {
      const r = await sql`SELECT COUNT(*) as count FROM follows WHERE following_id = ${farmerId} AND status = 'accepted'`;
      followers_count = parseInt(String(r?.[0]?.count || 0));
    } catch (e) { console.error("followers count:", e); }

    try {
      const r = await sql`SELECT COUNT(*) as count FROM follows WHERE user_id = ${farmerId} AND status = 'accepted'`;
      following_count = parseInt(String(r?.[0]?.count || 0));
    } catch (e) { console.error("following count:", e); }

    try {
      const r = await sql`SELECT COUNT(*) as count FROM crops WHERE user_id = ${farmerId}`;
      crops_count = parseInt(String(r?.[0]?.count || 0));
    } catch (e) { console.error("crops count:", e); }

    try {
      const r = await sql`SELECT COUNT(*) as count FROM machinery WHERE owner_id = ${farmerId}`;
      equipments_count = parseInt(String(r?.[0]?.count || 0));
    } catch (e) { console.error("equipment count:", e); }

    // ── Followers / Following ────────────────────────────────────────────────
    let followers: any[] = [], following: any[] = [];

    try {
      followers = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.user_id = u.id
        WHERE f.following_id = ${farmerId} AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `;
    } catch (e) { console.error("followers:", e); }

    try {
      following = await sql`
        SELECT u.id, u.name, u.image FROM follows f
        JOIN "user" u ON f.following_id = u.id
        WHERE f.user_id = ${farmerId} AND f.status = 'accepted'
        ORDER BY f.created_at DESC
      `;
    } catch (e) { console.error("following:", e); }

    // ── Crops (with cert fields inline) ─────────────────────────────────────
    let crops: any[] = [];
    try {
      crops = await sql`
        SELECT
          id,
          crop_name,
          years_of_experience,
          expertise_level,
          expected_yield_date,
          expected_yield_quantity,
          expected_yield_quantity_uom,
          is_crop_waste,
          certificate_url,
          grade,
          certification_type
        FROM crops
        WHERE user_id = ${farmerId}
        ORDER BY crop_name
        LIMIT 50
      `;
    } catch (e) { console.error("crops:", e); }

    // ── Equipment ────────────────────────────────────────────────────────────
    let equipment: any[] = [];
    try {
      equipment = await sql`
        SELECT id, name, model, daily_rate, image_url
        FROM machinery
        WHERE owner_id = ${farmerId}
        LIMIT 50
      `;
    } catch (e) { console.error("equipment:", e); }

    // ── Certificates come from crops inline (certificate_url, grade, certification_type)
    // No separate certificates table query needed.
    const certificates: any[] = [];

    // ── Reels ────────────────────────────────────────────────────────────────
    let reels: any[] = [];
    try {
      reels = await sql`
        SELECT
          r.id, r.user_id, r.video_url, r.caption, r.thumbnail_url, r.created_at,
          (SELECT COUNT(*) FROM reel_likes    WHERE reel_id = r.id) AS likes,
          (SELECT COUNT(*) FROM reel_comments WHERE reel_id = r.id) AS comments
        FROM reels r
        WHERE r.user_id = ${farmerId}
        ORDER BY r.created_at DESC
        LIMIT 50
      `;

      if (currentUserId) {
        reels = await Promise.all(reels.map(async (reel) => {
          try {
            const lc = await sql`
              SELECT COUNT(*) as count FROM reel_likes
              WHERE reel_id = ${reel.id} AND user_id = ${currentUserId}
            `;
            return { ...reel, is_liked: parseInt(String(lc?.[0]?.count || 0)) > 0 };
          } catch { return { ...reel, is_liked: false }; }
        }));
      }

      // Attach crop tags from reel_crop_tags table (if it exists)
      try {
        const reelIds = reels.map((r: any) => r.id);
        if (reelIds.length > 0) {
          const tags = await sql`
            SELECT reel_id, crop_name FROM reel_crop_tags
            WHERE reel_id = ANY(${reelIds}::uuid[])
          `;
          const tagMap: Record<string, string[]> = {};
          tags.forEach((t: any) => {
            if (!tagMap[t.reel_id]) tagMap[t.reel_id] = [];
            tagMap[t.reel_id].push(t.crop_name);
          });
          reels = reels.map((r: any) => ({ ...r, crop_tags: tagMap[r.id] || [] }));
        }
      } catch {
        // reel_crop_tags table may not exist yet — crop matching falls back to caption
        reels = reels.map((r: any) => ({ ...r, crop_tags: [] }));
      }
    } catch (e) { console.error("reels:", e); }

    // ── Follow status ────────────────────────────────────────────────────────
    let followStatus: 'none' | 'pending' | 'accepted' = 'none';
    let isFollowing = false;
    let isAdminViewer = false;
    if (currentUserId && currentUserId !== farmerId) {
      try {
        const fc = await sql`
          SELECT status FROM follows
          WHERE user_id = ${currentUserId} AND following_id = ${farmerId}
          LIMIT 1
        `;
        followStatus = fc?.[0]?.status === 'accepted' || fc?.[0]?.status === 'pending' ? fc[0].status : 'none';
        isFollowing = followStatus === 'accepted';
      } catch (e) { console.error("follow check:", e); }
    }
    if (currentUserId) {
      try {
        const viewerRows = await sql`
          SELECT COALESCE(NULLIF(u.role, ''), r.name, '') AS role, r.display_name AS role_display_name, u.role_id
          FROM "user" u
          LEFT JOIN roles r ON u.role_id = r.id
          WHERE u.id = ${currentUserId}
          LIMIT 1
        `;
        isAdminViewer = isAdminRole(viewerRows?.[0]);
      } catch (e) { console.error("viewer role check:", e); }
    }

    const canCall = Boolean(
      farmer.phone &&
      (isAdminViewer || (farmer.calling_enabled && (currentUserId === farmerId || followStatus === 'accepted')))
    );

    // ── Reverse geocode fallback ─────────────────────────────────────────────
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
      } catch { /* ignore */ }
    }

    // ── Response ─────────────────────────────────────────────────────────────
    console.log(`[profile] farmerId=${farmerId} equipment count=${equipment.length}`, equipment.slice(0, 2));
    return NextResponse.json({
      id: farmer.id,
      name: farmer.name,
      email: farmer.email,
      phone: canCall ? farmer.phone || null : null,
      calling_enabled: farmer.calling_enabled,
      can_call: canCall,
      image: farmer.image || null,
      bio: farmer.bio || null,
      location: locationText,
      latitude: farmer.latitude ? parseFloat(farmer.latitude) : null,
      longitude: farmer.longitude ? parseFloat(farmer.longitude) : null,
      role: farmer.role || 'buyer',
      supplier_types: farmer.supplier_types || [],
      followers_count,
      following_count,
      crops_count,
      equipments_count,
      certificates_count: certificates.length,
      crops:        Array.isArray(crops)        ? crops        : [],
      equipment:    Array.isArray(equipment)    ? equipment    : [],
      followers:    Array.isArray(followers)    ? followers    : [],
      following:    Array.isArray(following)    ? following    : [],
      reels:        Array.isArray(reels)        ? reels        : [],
      certificates: Array.isArray(certificates) ? certificates : [],
      isFollowing,
      followStatus,
    });

  } catch (error: any) {
    console.error("Farmer profile error:", error);
    return NextResponse.json(
      { error: "Failed to get farmer profile", details: error?.message || String(error) },
      { status: 500 }
    );
  }
}
