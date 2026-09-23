import sql from '@/app/api/utils/sql';
import { FpoError } from './fpo-access';
import { resolveLegacyLocation, validCoordinates, validateDistrict } from './fpo-location';

// Caller holds a row lock on the user. No independent membership list to drift.
export async function assignFarmer(tx: any, farmerId: string, districtId: string | null, source: string, reason: string | null = null) {
  const [u] = await tx`SELECT role FROM "user" WHERE id=${farmerId} FOR UPDATE`;
  if (!u) throw new FpoError('Farmer not found',404);
  let groupId = null;
  let status = u.role !== 'farmer' ? 'not_farmer' : districtId ? 'pending_fpo' : 'pending_location';
  if (u.role === 'farmer' && districtId) {
    const [f] = await tx`SELECT f.status,g.id FROM digital_fpos f JOIN farmer_groups g ON g.digital_fpo_id=f.id WHERE f.district_id=${districtId} FOR SHARE OF f`;
    if (f?.status === 'active') { groupId = f.id; status = 'assigned'; }
    else if (f) status = 'inactive_fpo';
  }
  const [assignment] = await tx`
    INSERT INTO farmer_fpo_assignments(farmer_id,district_id,group_id,assignment_status,assignment_source,reason,assigned_at)
    VALUES(${farmerId},${districtId},${groupId},${status},${source},${reason},${groupId ? new Date() : null})
    ON CONFLICT(farmer_id) DO UPDATE SET district_id=excluded.district_id,group_id=excluded.group_id,
      assignment_status=excluded.assignment_status,assignment_source=excluded.assignment_source,reason=excluded.reason,
      assigned_at=CASE WHEN farmer_fpo_assignments.group_id IS NOT DISTINCT FROM excluded.group_id THEN farmer_fpo_assignments.assigned_at ELSE excluded.assigned_at END,
      updated_at=now()
    RETURNING *`;
  return assignment;
}

export async function prepareLocation(body: any, current: any, registration = false) {
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const lat = body.latitude === undefined ? current.latitude : body.latitude;
    const lng = body.longitude === undefined ? current.longitude : body.longitude;
    if (!(lat === null && lng === null) && !validCoordinates(lat,lng)) throw new FpoError('Invalid latitude or longitude');
  }
  if (registration || body.state !== undefined || body.district !== undefined) {
    return { district: await validateDistrict(body.state,body.district), source: registration ? 'registration' : 'profile_update', reason: null };
  }
  const changed = ['location','latitude','longitude'].some(k => k in body && String(body[k] ?? '') !== String(current[k] ?? ''));
  if (changed) {
    // An edited address must not reuse coordinates belonging to the old address.
    const p = { ...current, ...body };
    if ('location' in body && body.location !== current.location && !('latitude' in body) && !('longitude' in body)) p.latitude = p.longitude = null;
    return resolveLegacyLocation(p);
  }
  return null;
}

export async function processFarmer(farmerId: string, dryRun = false) {
  const [before] = await sql`SELECT * FROM "user" WHERE id=${farmerId} AND role='farmer'`;
  if (!before) throw new FpoError('Farmer not found',404);
  const [existing] = await sql`SELECT * FROM farmer_fpo_assignments WHERE farmer_id=${farmerId}`;
  // Keep explicit registration/manual/profile selections. Legacy records use coordinates, then address.
  let resolved: any;
  if (existing?.district_id && ['registration','profile_update','admin_manual'].includes(existing.assignment_source)) {
    const [district] = await sql`SELECT * FROM fpo_districts WHERE id=${existing.district_id}`;
    resolved = { district, source: existing.assignment_source, reason: null };
  } else resolved = await resolveLegacyLocation(before);
  if (dryRun) return { farmer_id: farmerId, district: resolved.district, source: resolved.source, reason: resolved.reason, dry_run: true };
  return sql.begin(async tx => {
    const [now] = await tx`SELECT * FROM "user" WHERE id=${farmerId} FOR UPDATE`;
    // Do not overwrite a profile changed while the provider was resolving it.
    if (JSON.stringify([now.location,now.latitude,now.longitude,now.district_id,now.role,now.updatedAt]) !== JSON.stringify([before.location,before.latitude,before.longitude,before.district_id,before.role,before.updatedAt])) throw new FpoError('Profile changed; retry this farmer',409);
    await tx`UPDATE "user" SET district_id=${resolved.district?.id || null} WHERE id=${farmerId}`;
    return assignFarmer(tx,farmerId,resolved.district?.id || null,resolved.source,resolved.reason);
  });
}
