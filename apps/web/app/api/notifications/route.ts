export const dynamic = 'force-dynamic';
import sql from "@/app/api/utils/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const since = searchParams.get("since"); // ISO timestamp

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

const sinceDate = since
  ? new Date(new Date(since).getTime() - 60000) // -1 min
  : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // 1. New messages received by this user
    const newMessages = await sql`
      SELECT
        m.id,
        m.message,
        m.created_at,
        m.sender_id,
        u.name   AS sender_name,
        u.image  AS sender_image,
        m.machinery_id
      FROM messages m
      JOIN "user" u ON u.id = m.sender_id
      WHERE m.receiver_id = ${userId}
        AND m.sender_id   != ${userId}
        AND m.created_at   > ${sinceDate}
      ORDER BY m.created_at DESC
      LIMIT 20
    `;

    // 2. New booking requests — owner notified when someone books their equipment
    const newBookings = await sql`
      SELECT
        r.id,
        r.machinery_name,
        r.status,
        r.created_at,
        r.user_id,
        u.name   AS renter_name,
        u.image  AS renter_image
      FROM reservations r
      JOIN "user" u ON u.id = r.user_id
      WHERE r.owner_id  = ${userId}
        AND r.status    = 'pending'
        AND r.created_at > ${sinceDate}
      ORDER BY r.created_at DESC
      LIMIT 10
    `;

    // ---------------------------------------------------------------------------
    // FIX 2 — Use updated_at (not created_at) for booking status changes.
    //   When an owner accepts/rejects a booking the row's created_at stays the
    //   same as the original request date, so filtering on created_at means
    //   status-update notifications are NEVER returned. updated_at reflects when
    //   the status actually changed.
    //
    //   Prerequisite: your reservations table must have an updated_at column that
    //   is set automatically (trigger or explicit SET updated_at = NOW() in your
    //   update queries).
    // ---------------------------------------------------------------------------
    const bookingUpdates = await sql`
      SELECT
        r.id,
        r.machinery_name,
        r.status,
        r.updated_at,
        r.owner_id,
        u.name   AS owner_name,
        u.image  AS owner_image
      FROM reservations r
      JOIN "user" u ON u.id = r.owner_id
      WHERE r.user_id    = ${userId}
        AND r.status     IN ('accepted', 'rejected', 'cancelled', 'completed')
        AND r.updated_at  > ${sinceDate}   -- FIX 2: was r.created_at
      ORDER BY r.updated_at DESC            -- FIX 2: was r.created_at
      LIMIT 10
    `;


    const ownerBookingUpdates = await sql`
  SELECT
    r.id,
    r.machinery_name,
    r.status,
    r.updated_at,
    r.user_id,
    u.name   AS renter_name,
    u.image  AS renter_image
  FROM reservations r
  JOIN "user" u ON u.id = r.user_id
  WHERE r.owner_id   = ${userId}
    AND r.status     IN ('cancelled', 'completed')
    AND r.updated_at  > ${sinceDate}
  ORDER BY r.updated_at DESC
  LIMIT 10
`;

    // ---------------------------------------------------------------------------
    // FIX 4 — Equipment availability notifications should target RENTERS, not
    //   owners. Querying WHERE m.owner_id = userId meant the owner was notified
    //   about their own equipment changes — something they already know. Instead,
    //   join reservations to find equipment belonging to other owners that THIS
    //   user has actively booked/reserved.
    // ---------------------------------------------------------------------------
    const equipmentChanges = await sql`
      SELECT DISTINCT ON (m.id)
        m.id,
        m.name,
        m.is_unavailable,
        m.updated_at,
        m.owner_id,
        u.name AS owner_name
      FROM machinery m
      JOIN "user"       u ON u.id = m.owner_id
      JOIN reservations r ON r.machinery_id = m.id
      WHERE r.user_id    = ${userId}          -- FIX 4: notify the renter, not the owner
        AND m.owner_id  != ${userId}          -- extra guard: exclude own equipment
        AND m.updated_at > ${sinceDate}
      ORDER BY m.id, m.updated_at DESC
      LIMIT 10
    `.catch(() => []);

    // Global announcements
// Global announcements — notify all users
// In your notifications route — use a fixed 7-day window for admin content
const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

// New reels posted by admins — always use 7-day window, ignore `since`
const adminReels = await sql`
  SELECT r.id, r.caption, r.thumbnail_url, r.created_at,
         u.name AS admin_name, u.image AS admin_image
  FROM reels r
  JOIN "user" u ON u.id = r.user_id
  WHERE (u.role = 'superadmin' OR u.role_id = 5)
    AND r.user_id != ${userId}
    AND r.created_at > ${sevenDaysAgo}   -- ← fixed 7-day window, not sinceDate
  ORDER BY r.created_at DESC
  LIMIT 5
`.catch(() => []);

// Same fix for announcements
const announcements = await sql`
  SELECT a.id, a.title, a.body, a.created_at, u.name AS admin_name, u.image AS admin_image
  FROM announcements a
  LEFT JOIN "user" u ON u.id = a.created_by
  WHERE a.created_at > ${sevenDaysAgo}   -- ← fixed 7-day window
    AND (a.expires_at IS NULL OR a.expires_at > NOW())
    AND (a.scheduled_at IS NULL OR a.last_sent_at IS NOT NULL)
  ORDER BY a.created_at DESC
  LIMIT 5
`.catch(() => []);


// Pending follow requests for this user
const followRequests = await sql`
  SELECT f.user_id, f.created_at, u.name, u.image
  FROM follows f
  JOIN "user" u ON u.id = f.user_id
  WHERE f.following_id = ${userId}
    AND f.status = 'pending'
    AND f.created_at > ${sinceDate}
  ORDER BY f.created_at DESC
  LIMIT 10
`.catch(() => []);

// New content from farmers/buyers the current user follows
const followedCrops = await sql`
  SELECT
    c.id,
    c.crop_name,
    c.crop_type,
    c.is_crop_waste,
    c.created_at,
    u.id AS creator_id,
    u.name AS creator_name,
    u.image AS creator_image
  FROM crops c
  JOIN follows f ON f.following_id = c.user_id
  JOIN "user" u ON u.id = c.user_id
  WHERE f.user_id = ${userId}
    AND f.status = 'accepted'
    AND c.user_id != ${userId}
    AND c.created_at > ${sinceDate}
  ORDER BY c.created_at DESC
  LIMIT 10
`.catch(() => []);

const followedEquipment = await sql`
  SELECT
    m.id,
    m.name,
    m.image_url,
    m.created_at,
    u.id AS creator_id,
    u.name AS creator_name,
    u.image AS creator_image
  FROM machinery m
  JOIN follows f ON f.following_id = m.owner_id
  JOIN "user" u ON u.id = m.owner_id
  WHERE f.user_id = ${userId}
    AND f.status = 'accepted'
    AND m.owner_id != ${userId}
    AND m.created_at > ${sinceDate}
  ORDER BY m.created_at DESC
  LIMIT 10
`.catch(() => []);

const followedReels = await sql`
  SELECT
    r.id,
    r.caption,
    r.thumbnail_url,
    r.created_at,
    u.id AS creator_id,
    u.name AS creator_name,
    u.image AS creator_image
  FROM reels r
  JOIN follows f ON f.following_id = r.user_id
  JOIN "user" u ON u.id = r.user_id
  WHERE f.user_id = ${userId}
    AND f.status = 'accepted'
    AND r.user_id != ${userId}
    AND r.created_at > ${sinceDate}
  ORDER BY r.created_at DESC
  LIMIT 10
`.catch(() => []);

// Crop-based discovery: farmers see buyers, buyers see farmers.
const viewerMatchRows = await sql`
  SELECT
    u.id,
    CASE
      WHEN LOWER(COALESCE(u.role, '')) = 'farmer' OR u.role_id = 1 THEN 'farmer'
      WHEN LOWER(COALESCE(u.role, '')) = 'buyer' OR u.role_id = 2 THEN 'buyer'
      ELSE LOWER(COALESCE(u.role, ''))
    END AS role,
    COALESCE(u.supplier_types, ARRAY[]::text[]) AS supplier_types,
    u.latitude,
    u.longitude,
    (SELECT COUNT(*)::int FROM crops c WHERE c.user_id = u.id) AS crop_count,
    (SELECT COUNT(*)::int FROM machinery m WHERE m.owner_id = u.id) AS equipment_count
  FROM "user" u
  WHERE u.id = ${userId}
  LIMIT 1
`.catch(() => []);

const viewerMatch: any = viewerMatchRows[0] || null;
const hasMatchProfile =
  viewerMatch &&
  ['farmer', 'buyer'].includes(viewerMatch.role) &&
  Number(viewerMatch.crop_count) > 0 &&
  viewerMatch.latitude != null &&
  viewerMatch.longitude != null;

const matchedProfiles = hasMatchProfile ? await sql`
  WITH viewer_crops AS (
    SELECT DISTINCT LOWER(TRIM(crop_name)) AS normalized_crop
    FROM crops
    WHERE user_id = ${userId}
      AND NULLIF(TRIM(crop_name), '') IS NOT NULL
  ),
  candidates AS (
    SELECT
      u.id, u.name, u.image, u.location, u.latitude, u.longitude,
      ARRAY_AGG(DISTINCT c.crop_name ORDER BY c.crop_name) AS matched_crops,
      6371 * ACOS(
        LEAST(1, GREATEST(-1,
          COS(RADIANS(${Number(viewerMatch.latitude)})) *
          COS(RADIANS(u.latitude)) *
          COS(RADIANS(u.longitude) - RADIANS(${Number(viewerMatch.longitude)})) +
          SIN(RADIANS(${Number(viewerMatch.latitude)})) *
          SIN(RADIANS(u.latitude))
        ))
      ) AS distance_km
    FROM "user" u
    JOIN crops c ON c.user_id = u.id
    JOIN viewer_crops vc ON vc.normalized_crop = LOWER(TRIM(c.crop_name))
    WHERE u.id != ${userId}
      AND u.latitude IS NOT NULL
      AND u.longitude IS NOT NULL
      AND (
        (${viewerMatch.role} = 'farmer' AND (LOWER(COALESCE(u.role, '')) = 'buyer' OR u.role_id = 2))
        OR (${viewerMatch.role} = 'buyer' AND (LOWER(COALESCE(u.role, '')) = 'farmer' OR u.role_id = 1))
      )
    GROUP BY u.id, u.name, u.image, u.location, u.latitude, u.longitude
  )
  , nearest_pool AS (
    SELECT *
    FROM candidates
    ORDER BY distance_km ASC, name ASC
    LIMIT 10
  ),
  daily_selection AS (
    SELECT *
    FROM nearest_pool
    ORDER BY MD5(id || CURRENT_DATE::text)
    LIMIT 2
  )
  SELECT *
  FROM daily_selection
  ORDER BY distance_km ASC, name ASC
`.catch(() => []) : [];

    const notifications: any[] = [];

    newMessages.forEach((msg: any) => {
      notifications.push({
        id: `msg-${msg.id}`,
        type: 'message',
        title: msg.sender_name,
        body:
          msg.message.length > 60
            ? msg.message.substring(0, 60) + '...'
            : msg.message,
        image: msg.sender_image,
        time: msg.created_at,
        link: `/chat?userId=${msg.sender_id}`,
      });
    });

    newBookings.forEach((booking: any) => {
      notifications.push({
        id: `booking-new-${booking.id}`,
        type: 'booking_new',
        title: 'New Booking Request',
        body: `${booking.renter_name} wants to book ${booking.machinery_name}`,
        image: booking.renter_image,
        time: booking.created_at,
        link: `/user-profile`,
      });
    });

    bookingUpdates.forEach((booking: any) => {
      const statusLabels: Record<string, string> = {
        accepted: 'confirmed',
        rejected: 'declined',
        cancelled: 'cancelled',
        completed: 'completed',
      };
      const statusLabel = statusLabels[booking.status] || booking.status;
      notifications.push({
        id: `booking-update-${booking.id}`,
        type: 'booking_update',
        title: `Booking ${statusLabel}`,
        body: `Your booking for ${booking.machinery_name} was ${statusLabel}`,
        image: booking.owner_image,
        time: booking.updated_at,   // FIX 2: use updated_at as the notification time
        link: `/user-profile`,
        status: booking.status,
      });
    });

    // Owner notifications for cancellations / completions
ownerBookingUpdates.forEach((booking: any) => {
  const statusLabels: Record<string, string> = {
    cancelled: 'cancelled',
    completed: 'completed',
  };
  const statusLabel = statusLabels[booking.status] || booking.status;
  notifications.push({
    id: `booking-owner-update-${booking.id}`,
    type: 'booking_update',
    title: `Booking ${statusLabel}`,
    body: `${booking.renter_name} ${booking.status === 'cancelled' ? 'cancelled their' : 'completed a'} booking for ${booking.machinery_name}`,
    image: booking.renter_image,
    time: booking.updated_at,
    link: `/user-profile`,
    status: booking.status,
  });
});

    equipmentChanges.forEach((eq: any) => {
      if (!eq.updated_at || new Date(eq.updated_at) <= sinceDate) return;
      notifications.push({
        id: `equip-${eq.id}`,
        type: 'equipment',
        title: 'Equipment Status Changed',
        body: `${eq.name} is now ${eq.is_unavailable ? 'unavailable' : 'available'}`,
        image: null,
        time: eq.updated_at,
        link: `/machinery-details?id=${eq.id}`,
        available: !eq.is_unavailable,
      });
    });

announcements.forEach((ann: any) => {
  notifications.push({
    id: `ann-${ann.id}`,
    type: 'announcement',
    title: `📢 ${ann.title}`,
    body: ann.body,
    image: ann.admin_image ?? null,
    time: ann.created_at,
    link: `/home`,
  });
});

adminReels.forEach((reel: any) => {
  notifications.push({
    id: `reel-${reel.id}`,
    type: 'admin_reel',
    title: `🎬 New Video from ${reel.admin_name}`,
    body: reel.caption
      ? reel.caption.length > 60
        ? reel.caption.substring(0, 60) + '...'
        : reel.caption
      : 'Check out the latest video',
    image: reel.thumbnail_url ?? reel.admin_image ?? null,
    time: reel.created_at,
    link: `/reels?id=${reel.id}`,
  });
});


followRequests.forEach((req: any) => {
  notifications.push({
    id: `follow-req-${req.user_id}`,
    type: 'follow_request',
    title: 'New Follow Request',
    body: `${req.name} wants to follow you`,
    image: req.image,
    time: req.created_at,
    link: `/user-profile`,
    followerId: req.user_id,
  });
});

followedCrops.forEach((crop: any) => {
  const label = crop.is_crop_waste ? 'crop waste' : 'crop';
  notifications.push({
    id: `followed-crop-${crop.id}`,
    type: 'followed_crop',
    title: `New ${label} from ${crop.creator_name}`,
    body: `${crop.creator_name} added ${crop.crop_name}`,
    image: crop.creator_image,
    time: crop.created_at,
    link: `/farmer-profile?id=${crop.creator_id}`,
  });
});

followedEquipment.forEach((equipment: any) => {
  notifications.push({
    id: `followed-equipment-${equipment.id}`,
    type: 'followed_equipment',
    title: `New equipment from ${equipment.creator_name}`,
    body: `${equipment.creator_name} added ${equipment.name}`,
    image: equipment.image_url ?? equipment.creator_image,
    time: equipment.created_at,
    link: `/machinery-details?id=${equipment.id}`,
  });
});

followedReels.forEach((reel: any) => {
  notifications.push({
    id: `followed-reel-${reel.id}`,
    type: 'followed_reel',
    title: `New reel from ${reel.creator_name}`,
    body: reel.caption
      ? reel.caption.length > 60
        ? reel.caption.substring(0, 60) + '...'
        : reel.caption
      : 'Check out the latest reel',
    image: reel.thumbnail_url ?? reel.creator_image,
    time: reel.created_at,
    link: `/reels?reelId=${reel.id}&userId=${reel.creator_id}`,
  });
});

const recommendationDay = new Date();
recommendationDay.setUTCHours(0, 0, 0, 0);
const recommendationTime = recommendationDay.toISOString();

if (
  viewerMatch &&
  ['farmer', 'buyer'].includes(viewerMatch.role) &&
  (
    Number(viewerMatch.crop_count) === 0 ||
    viewerMatch.latitude == null ||
    viewerMatch.longitude == null
  )
) {
  const needsCrops = Number(viewerMatch.crop_count) === 0;
  notifications.push({
    id: `profile-match-setup-${userId}-${recommendationTime.slice(0, 10)}`,
    type: 'profile_match_setup',
    title: needsCrops ? 'Farmers and buyers are connecting directly' : 'Find crop partners near you',
    body: needsCrops
      ? `Others are benefiting by contacting ${viewerMatch.role === 'farmer' ? 'buyers' : 'farmers'} directly. Add the crops you ${viewerMatch.role === 'farmer' ? 'grow' : 'want to buy'} to get your matches.`
      : 'Add your location to discover the closest people matching your crops.',
    image: null,
    time: recommendationTime,
    link: needsCrops ? '/user-profile?addCrop=true' : '/user-profile',
  });
}

// Persistent role-based profile reminders. A fresh reminder is generated each
// day until the user adds the listing their role needs. Legacy suppliers with
// no saved subtype are treated as both commodity and equipment suppliers,
// which matches the supplier filtering and profile-management behaviour.
if (viewerMatch?.role === 'supplier') {
  const supplierTypes: string[] = Array.isArray(viewerMatch.supplier_types)
    ? viewerMatch.supplier_types
    : [];
  const isLegacySupplier = supplierTypes.length === 0;
  const needsCommodityListing =
    (isLegacySupplier || supplierTypes.includes('commodities')) &&
    Number(viewerMatch.crop_count) === 0;
  const needsEquipmentListing =
    (isLegacySupplier || supplierTypes.includes('equipment')) &&
    Number(viewerMatch.equipment_count) === 0;

  if (needsCommodityListing) {
    notifications.push({
      id: `profile-completion-crops-${userId}-${recommendationTime.slice(0, 10)}`,
      type: 'profile_completion',
      title: 'Add crops to complete your supplier profile',
      body: 'Show buyers what you supply. Adding your crops helps your profile appear in relevant searches, reach more people, and build a stronger CoFarmz network.',
      image: null,
      time: recommendationTime,
      link: '/user-profile?addCrop=true',
      persistent: true,
    });
  }

  if (needsEquipmentListing) {
    notifications.push({
      id: `profile-completion-equipment-${userId}-${recommendationTime.slice(0, 10)}`,
      type: 'profile_completion',
      title: 'Add equipment to complete your supplier profile',
      body: 'List the equipment you provide so nearby users can discover and contact you. A complete profile improves your reach and helps you grow your CoFarmz network.',
      image: null,
      time: recommendationTime,
      link: '/rent-machinery',
      persistent: true,
    });
  }
}

matchedProfiles.forEach((profile: any, index: number) => {
  const cropNames = Array.isArray(profile.matched_crops)
    ? profile.matched_crops.slice(0, 2).join(', ')
    : 'Your crop';
  const distance = Number(profile.distance_km);
  const targetLabel = viewerMatch.role === 'farmer' ? 'buyer' : 'farmer';

  notifications.push({
    id: `profile-match-${userId}-${profile.id}-${recommendationTime.slice(0, 10)}`,
    type: 'profile_match',
    title: index === 0
      ? `${profile.name} is your closest crop match`
      : `Another ${targetLabel} match: ${profile.name}`,
    body: `${targetLabel === 'buyer' ? 'Farmers' : 'Buyers'} are benefiting by contacting ${targetLabel}s directly for ${cropNames}. Connect with ${profile.name} · ${distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`} away${profile.location ? ` · ${profile.location}` : ''}`,
    image: profile.image,
    time: recommendationTime,
    link: `/farmer-profile?id=${profile.id}`,
    distanceKm: distance,
    matchedCrops: profile.matched_crops,
    targetSearchType: targetLabel === 'buyer' ? 'buyers' : 'farmers',
  });
});



    // Sort by time descending
    notifications.sort(
      (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    const trimmed = notifications.slice(0, 30);

    // ---------------------------------------------------------------------------
    // FIX 3 — Do NOT return unreadCount from the API.
    //   The frontend computes unread count itself by comparing notification
    //   timestamps against the NOTIF_READ_KEY stored in localStorage. This
    //   prevents the badge from resetting on every 30-second poll.
    //   We still return the field (as 0) so any existing consumers don't break.
    // ---------------------------------------------------------------------------
    return NextResponse.json({
      notifications: trimmed,
      unreadCount: 0, // FIX 3: frontend computes this from NOTIF_READ_KEY
    });
  } catch (error) {
    console.error("Notifications error:", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 });
  }
}
