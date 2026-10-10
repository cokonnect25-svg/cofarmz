import sql from '@/app/api/utils/sql';
import { resolveTaluk, selectFarmerFpo, validateTaluk, ensureTalukFpo } from './fpo-taluk';
import { FpoError } from './fpo-error';
import { resolveLegacyLocation, validCoordinates, validateDistrict } from './fpo-location';

// Caller holds a row lock on the user. No independent membership list to drift.
export async function assignFarmer(tx: any, farmerId: string, districtId: string | null, source: string, reason: string | null = null, selectedTaluk?: string | null) {
  const [u] = await tx`SELECT * FROM "user" WHERE id=${farmerId} FOR UPDATE`;
  if (!u) throw new FpoError('Farmer not found',404);
  const talukId = selectedTaluk == null ? await resolveTaluk(selectedTaluk === null ? {...u,taluk_id:null} : u,districtId,tx) : selectedTaluk;
  await tx`UPDATE "user" SET taluk_id=${talukId} WHERE id=${farmerId}`;
  let groupId = null;
  let status = u.role !== 'farmer' ? 'not_farmer' : districtId ? 'pending_fpo' : 'pending_location';
  if (u.role === 'farmer' && districtId) {
    if (talukId) await ensureTalukFpo(tx,districtId,talukId);
    const [f] = await tx`SELECT f.status,g.id FROM digital_fpos f JOIN farmer_groups g ON g.digital_fpo_id=f.id WHERE f.district_id=${districtId} AND f.taluk_id=${talukId} LIMIT 1 FOR SHARE OF f`;
    if (f?.status === 'active') { groupId = f.id; status = 'assigned'; }
    else if (f) status = 'inactive_fpo';
  }
  const [assignment] = await tx`
    INSERT INTO farmer_fpo_assignments(farmer_id,district_id,taluk_id,group_id,assignment_status,assignment_source,reason,assigned_at)
    VALUES(${farmerId},${districtId},${talukId},${groupId},${status},${source},${!talukId && districtId && u.role === 'farmer' ? 'Select Mandal / Taluk in your profile to join your FPO' : reason},${groupId ? new Date() : null})
    ON CONFLICT(farmer_id) DO UPDATE SET district_id=excluded.district_id,taluk_id=excluded.taluk_id,group_id=excluded.group_id,
      assignment_status=excluded.assignment_status,assignment_source=excluded.assignment_source,reason=excluded.reason,
      assigned_at=CASE WHEN farmer_fpo_assignments.group_id IS NOT DISTINCT FROM excluded.group_id THEN farmer_fpo_assignments.assigned_at ELSE excluded.assigned_at END,
      updated_at=now()
    RETURNING *`;
  return assignment;
}

export async function prepareLocation(body: any, current: any, registration = false): Promise<any> {
  if (body.latitude !== undefined || body.longitude !== undefined) {
    const lat = body.latitude === undefined ? current.latitude : body.latitude;
    const lng = body.longitude === undefined ? current.longitude : body.longitude;
    if (!(lat === null && lng === null) && !validCoordinates(lat,lng)) throw new FpoError('Invalid latitude or longitude');
  }
  if (registration || body.state !== undefined || body.district !== undefined) {
    const district = await validateDistrict(body.state,body.district);
    const taluk = await validateTaluk(body.taluk_id,district.id);
    return {district,selected_taluk_id:body.taluk_id === undefined ? undefined : taluk?.id || null,source:registration?'registration':'profile_update',reason:null};
  }
  // Explicit saved district is authoritative. GPS-only writes never change FPO membership.
  if (current.district_id) {
    if ('location' in body || body.taluk_id !== undefined) {
      const [district] = await sql`SELECT * FROM fpo_districts WHERE id=${current.district_id}`;
      const taluk = await validateTaluk(body.taluk_id,district.id);
      return {district,selected_taluk_id:body.taluk_id === undefined ? undefined : taluk?.id || null,source:'profile_update',reason:null};
    }
    return null;
  }
  if (body.taluk_id) throw new FpoError('Select State and District before selecting Mandal / Taluk');
  // Retry unresolved saved addresses even when the text has not changed:
  // a new locality mapping may now identify the district.
  if ('location' in body) {
    return resolveLegacyLocation({ location: body.location });
  }
  return null;
}

export async function planFarmerAssignment(profile: any, existingSource: string | null, catalogue: any[], fpos: any[]) {
  const resolved = profile.district_id
    ? { district: catalogue.find(d=>String(d.id)===String(profile.district_id)), source: existingSource || 'profile_update', reason: null }
    : await resolveLegacyLocation(profile,catalogue);
  const talukId = await resolveTaluk(profile,resolved.district?.id || null);
  const willCreateTaluk = Boolean(talukId && resolved.district && !fpos.some(f=>String(f.taluk_id)===String(talukId)) && fpos.some(f=>String(f.district_id)===String(resolved.district.id) && !f.taluk_id && f.status==='active'));
  const target = resolved.district ? selectFarmerFpo(resolved.district.id,talukId,fpos) : null;
  const status = !resolved.district ? 'pending_location' : willCreateTaluk ? 'pending_fpo' : !target ? 'pending_fpo' : target.status !== 'active' ? 'inactive_fpo' : 'assigned';
  return { farmer_id: profile.id, taluk_id: talukId, will_create_taluk_fpo:willCreateTaluk, district: resolved.district || null, source: resolved.source, reason: resolved.reason,
    assignment_status: status, group_id: status==='assigned'?target.group_id:null };
}

export async function processFarmer(farmerId: string, dryRun = false, catalogue?: any[]) {
  const [before] = await sql`SELECT * FROM "user" WHERE id=${farmerId} AND role='farmer'`;
  if (!before) throw new FpoError('Farmer not found',404);
  const [existing] = await sql`SELECT * FROM farmer_fpo_assignments WHERE farmer_id=${farmerId}`;
  const districts = catalogue || await sql<any[]>`SELECT id,state,district FROM fpo_districts`;
  const fpos = await sql<any[]>`SELECT f.district_id,f.taluk_id,f.status,g.id AS group_id FROM digital_fpos f JOIN farmer_groups g ON g.digital_fpo_id=f.id`;
  const preview = await planFarmerAssignment(before,existing?.assignment_source,districts,fpos);
  if (dryRun) return { ...preview, dry_run: true };
  return sql.begin(async tx => {
    const [now] = await tx`SELECT * FROM "user" WHERE id=${farmerId} FOR UPDATE`;
    if (!now) throw new FpoError('Farmer not found',404);
    // Do not overwrite a profile changed while the provider was resolving it.
    if (JSON.stringify([now.location,now.latitude,now.longitude,now.district_id,now.taluk_id,now.role,now.updatedAt]) !== JSON.stringify([before.location,before.latitude,before.longitude,before.district_id,before.taluk_id,before.role,before.updatedAt])) throw new FpoError('Profile changed; retry this farmer',409);
    await tx`UPDATE "user" SET district_id=${preview.district?.id || null},taluk_id=${preview.taluk_id} WHERE id=${farmerId}`;
    const assignment = await assignFarmer(tx,farmerId,preview.district?.id || null,preview.source,preview.reason,preview.taluk_id);
    return {...preview,...assignment,dry_run:false};
  });
}

// Resolve saved addresses as well as explicit taluk selections when a new FPO is created.
export async function enrollSavedDistrict(tx: any, districtId: string, groupId: string) {
  const rows = await tx`SELECT u.id,a.assignment_source FROM "user" u LEFT JOIN farmer_fpo_assignments a ON a.farmer_id=u.id WHERE u.role='farmer' AND u.district_id=${districtId} ORDER BY u.id FOR UPDATE OF u`;
  let assigned = 0;
  for (const row of rows) {
    const result = await assignFarmer(tx,row.id,districtId,row.assignment_source || 'profile_update');
    if (result.group_id === groupId) assigned++;
  }
  return assigned;
}
