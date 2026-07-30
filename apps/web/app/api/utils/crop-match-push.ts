import sql from "@/app/api/utils/sql";
import { sendPushToUser } from "@/app/api/utils/push";

type MatchUser = {
  id: string;
  name: string | null;
  role: "farmer" | "buyer";
  distance_km: number;
};

/**
 * Sends immediate native pushes when a newly-added crop creates farmer/buyer
 * matches. Failures are deliberately contained so saving the crop still works.
 */
export async function sendCropMatchPushes(
  sourceUserId: string,
  cropName: string
) {
  try {
    const sourceRows = await sql`
      SELECT
        u.id,
        u.name,
        CASE
          WHEN LOWER(COALESCE(u.role, '')) = 'farmer' OR u.role_id = 1 THEN 'farmer'
          WHEN LOWER(COALESCE(u.role, '')) = 'buyer' OR u.role_id = 2 THEN 'buyer'
          ELSE LOWER(COALESCE(u.role, ''))
        END AS role,
        u.latitude,
        u.longitude
      FROM "user" u
      WHERE u.id = ${sourceUserId}
      LIMIT 1
    `;

    const source: any = sourceRows[0];
    if (
      !source ||
      !["farmer", "buyer"].includes(source.role) ||
      source.latitude == null ||
      source.longitude == null
    ) {
      return;
    }

    const matches = (await sql`
      SELECT
        u.id,
        u.name,
        CASE
          WHEN LOWER(COALESCE(u.role, '')) = 'farmer' OR u.role_id = 1 THEN 'farmer'
          ELSE 'buyer'
        END AS role,
        6371 * ACOS(
          LEAST(1, GREATEST(-1,
            COS(RADIANS(${Number(source.latitude)})) *
            COS(RADIANS(u.latitude)) *
            COS(RADIANS(u.longitude) - RADIANS(${Number(source.longitude)})) +
            SIN(RADIANS(${Number(source.latitude)})) *
            SIN(RADIANS(u.latitude))
          ))
        ) AS distance_km
      FROM "user" u
      JOIN crops c ON c.user_id = u.id
      WHERE u.id != ${sourceUserId}
        AND u.latitude IS NOT NULL
        AND u.longitude IS NOT NULL
        AND LOWER(TRIM(c.crop_name)) = LOWER(TRIM(${cropName}))
        AND (
          (${source.role} = 'farmer' AND (LOWER(COALESCE(u.role, '')) = 'buyer' OR u.role_id = 2))
          OR
          (${source.role} = 'buyer' AND (LOWER(COALESCE(u.role, '')) = 'farmer' OR u.role_id = 1))
        )
      GROUP BY u.id, u.name, u.role, u.role_id, u.latitude, u.longitude
      ORDER BY distance_km ASC
      LIMIT 10
    `) as unknown as MatchUser[];

    if (matches.length === 0) return;

    const sourceRoleLabel = source.role === "farmer" ? "farmer" : "buyer";
    const matchRoleLabel = source.role === "farmer" ? "buyer" : "farmer";

    await Promise.all([
      sendPushToUser(sourceUserId, {
        title: `New ${matchRoleLabel} match for ${cropName}`,
        body: `${matches[0].name || `A nearby ${matchRoleLabel}`} matches your ${cropName} crop.`,
        url: `/farmer-profile?id=${matches[0].id}`,
        tag: `crop-match-${sourceUserId}-${String(cropName).toLowerCase()}`,
        data: {
          type: "profile_match",
          matchedCrop: cropName,
          matchedUserId: matches[0].id,
        },
      }),
      ...matches.map((match: MatchUser) =>
        sendPushToUser(match.id, {
          title: `New ${sourceRoleLabel} match for ${cropName}`,
          body: `${source.name || `A nearby ${sourceRoleLabel}`} just added ${cropName}, matching your crop interest.`,
          url: `/farmer-profile?id=${sourceUserId}`,
          tag: `crop-match-${match.id}-${sourceUserId}-${String(cropName).toLowerCase()}`,
          data: {
            type: "profile_match",
            matchedCrop: cropName,
            matchedUserId: sourceUserId,
          },
        })
      ),
    ]);
  } catch (error) {
    console.error("Crop match push notification error:", error);
  }
}
