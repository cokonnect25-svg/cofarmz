import sql from '@/app/api/utils/sql';
import { addressPhrases, fpoName } from './fpo-location';
import { FpoError } from './fpo-error';

export async function validateTaluk(id: unknown, districtId: string, db: any = sql) {
  if (id === undefined || id === null || id === '') return null;
  if (!/^\d+$/.test(String(id))) throw new FpoError('Select a valid mandal/taluk');
  const [row] = await db`SELECT * FROM fpo_taluks WHERE id=${String(id)} AND district_id=${districtId}`;
  if (!row) throw new FpoError('Mandal/taluk does not belong to the selected district');
  return row;
}

export async function resolveTaluk(profile: any, districtId: string | null, db: any = sql) {
  if (!districtId) return null;
  if (profile.taluk_id && String(profile.district_id) === String(districtId))
    return (await validateTaluk(profile.taluk_id,districtId,db))?.id || null;
  const phrases = addressPhrases(String(profile.location || ''));
  if (!phrases.length) return null;
  const rows = await db`SELECT DISTINCT t.id FROM fpo_taluks t
    LEFT JOIN fpo_localities l ON l.district_id=t.district_id AND l.code=t.code AND l.kind='subdistrict'
    WHERE t.district_id=${districtId} AND (l.name_key=ANY(${phrases}::text[])
      OR lower(t.name)=ANY(${phrases}::text[]))`;
  return rows.length === 1 ? rows[0].id : null;
}

export function selectFarmerFpo(districtId: string, talukId: string | null, fpos: any[]) {
  const sameDistrict = fpos.filter(f=>String(f.district_id)===String(districtId));
  return (talukId ? sameDistrict.find(f=>String(f.taluk_id)===String(talukId)) : null)
    || null;
}

// Assignment creates only a validated child of an already provisioned district.
// Preserve existing subgroup IDs, names, creators and inactive status on retries.
export async function ensureTalukFpo(db: any, districtId: string, talukId: string) {
  const [parent] = await db`SELECT f.created_by,d.state,d.district,t.name
    FROM digital_fpos f JOIN fpo_districts d ON d.id=f.district_id
    JOIN fpo_taluks t ON t.district_id=d.id AND t.id=${talukId}
    WHERE f.district_id=${districtId} AND f.taluk_id IS NULL AND f.status='active' FOR SHARE OF f`;
  if (!parent) return;
  await db`INSERT INTO digital_fpos(district_id,taluk_id,name,created_by)
    VALUES(${districtId},${talukId},${fpoName(`${parent.name}_${parent.district}`,parent.state)},${parent.created_by})
    ON CONFLICT DO NOTHING`;
  await db`INSERT INTO farmer_groups(digital_fpo_id)
    SELECT id FROM digital_fpos WHERE district_id=${districtId} AND taluk_id=${talukId}
    ON CONFLICT(digital_fpo_id) DO NOTHING`;
}

export async function ensureDistrictTalukFpos(db: any, districtId?: string) {
  const taluks=await db`SELECT t.id,t.district_id,t.name,d.district,d.state,f.created_by
    FROM fpo_taluks t JOIN fpo_districts d ON d.id=t.district_id
    JOIN digital_fpos f ON f.district_id=d.id AND f.taluk_id IS NULL
    WHERE f.status='active' AND (${districtId || null}::bigint IS NULL OR d.id=${districtId || null}::bigint)`;
  const values=taluks.map((t:any)=>({district_id:t.district_id,taluk_id:t.id,
    name:fpoName(`${t.name}_${t.district}`,t.state),created_by:t.created_by}));
  if (values.length) await db`INSERT INTO digital_fpos ${db(values,'district_id','taluk_id','name','created_by')} ON CONFLICT DO NOTHING`;
  await db`INSERT INTO farmer_groups(digital_fpo_id) SELECT f.id FROM digital_fpos f
    WHERE f.taluk_id IS NOT NULL AND (${districtId || null}::bigint IS NULL OR f.district_id=${districtId || null}::bigint)
    ON CONFLICT(digital_fpo_id) DO NOTHING`;
}
