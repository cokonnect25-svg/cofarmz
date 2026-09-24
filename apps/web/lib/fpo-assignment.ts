import sql from '@/app/api/utils/sql';
import { FpoError } from './fpo-error';
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
  // Explicit saved district is authoritative. GPS-only writes never change FPO membership.
  if (current.district_id) return null;
  if ('location' in body && String(body.location || '') !== String(current.location || '')) {
    return resolveLegacyLocation({ location: body.location });
  }
  return null;
}

export async function planFarmerAssignment(profile: any, existingSource: string | null, catalogue: any[], fpos: any[]) {
  const resolved = profile.district_id
    ? { district: catalogue.find(d=>String(d.id)===String(profile.district_id)), source: existingSource || 'profile_update', reason: null }
    : await resolveLegacyLocation(profile,catalogue);
  const target = resolved.district ? fpos.find(f=>String(f.district_id)===String(resolved.district.id)) : null;
  const status = !resolved.district ? 'pending_location' : !target ? 'pending_fpo' : target.status !== 'active' ? 'inactive_fpo' : 'assigned';
  return { farmer_id: profile.id, district: resolved.district || null, source: resolved.source, reason: resolved.reason,
    assignment_status: status, group_id: status==='assigned'?target.group_id:null };
}

export async function processFarmer(farmerId: string, dryRun = false, catalogue?: any[]) {
  const [before] = await sql`SELECT * FROM "user" WHERE id=${farmerId} AND role='farmer'`;
  if (!before) throw new FpoError('Farmer not found',404);
  const [existing] = await sql`SELECT * FROM farmer_fpo_assignments WHERE farmer_id=${farmerId}`;
  const districts = catalogue || await sql<any[]>`SELECT id,state,district FROM fpo_districts`;
  const fpos = await sql<any[]>`SELECT f.district_id,f.status,g.id AS group_id FROM digital_fpos f JOIN farmer_groups g ON g.digital_fpo_id=f.id`;
  const preview = await planFarmerAssignment(before,existing?.assignment_source,districts,fpos);
  if (dryRun) return { ...preview, dry_run: true };
  return sql.begin(async tx => {
    const [now] = await tx`SELECT * FROM "user" WHERE id=${farmerId} FOR UPDATE`;
    if (!now) throw new FpoError('Farmer not found',404);
    // Do not overwrite a profile changed while the provider was resolving it.
    if (JSON.stringify([now.location,now.latitude,now.longitude,now.district_id,now.role,now.updatedAt]) !== JSON.stringify([before.location,before.latitude,before.longitude,before.district_id,before.role,before.updatedAt])) throw new FpoError('Profile changed; retry this farmer',409);
    await tx`UPDATE "user" SET district_id=${preview.district?.id || null} WHERE id=${farmerId}`;
    const assignment = await assignFarmer(tx,farmerId,preview.district?.id || null,preview.source,preview.reason);
    return {...preview,...assignment,dry_run:false};
  });
}

// Called only during admin FPO creation; enroll farmers with already resolved saved districts.
export async function enrollSavedDistrict(tx: any, districtId: string, groupId: string) {
  const rows = await tx`WITH eligible AS (
    SELECT id,district_id FROM "user" WHERE role='farmer' AND district_id=${districtId} ORDER BY id FOR UPDATE
  ) INSERT INTO farmer_fpo_assignments(farmer_id,district_id,group_id,assignment_status,assignment_source,reason,assigned_at)
    SELECT u.id,u.district_id,${groupId},'assigned',COALESCE(a.assignment_source,'profile_update'),NULL,now()
    FROM eligible u LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id
    ON CONFLICT(farmer_id) DO UPDATE SET district_id=excluded.district_id,group_id=excluded.group_id,
      assignment_status='assigned',reason=NULL,assigned_at=excluded.assigned_at,updated_at=now()
    RETURNING farmer_id`;
  return rows.length;
}
