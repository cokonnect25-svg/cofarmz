import { ensureDistrictTalukFpos } from './fpo-taluk';
import sql from '@/app/api/utils/sql';
import { fpoName } from './fpo-location';

// Provision the catalogue atomically; membership processing uses separate,
// retryable farmer transactions so a bad profile cannot block provisioning.
export async function provisionCatalogue(actorId: string, level: 'district' | 'taluk' = 'district') {
  return sql.begin(async tx => {
    const districts = await tx`SELECT id,state,district FROM fpo_districts ORDER BY id`;
    if (level === 'taluk') {
      const parents= districts.map(d=>({district_id:d.id,name:fpoName(d.district,d.state),created_by:actorId}));
      if (parents.length) await tx`INSERT INTO digital_fpos ${tx(parents,'district_id','name','created_by')} ON CONFLICT DO NOTHING`;
    }
    const taluks = level === 'taluk' ? await tx`SELECT t.id,t.district_id,t.name,d.state,d.district FROM fpo_taluks t JOIN fpo_districts d ON d.id=t.district_id ORDER BY t.id` : [];
    if (level === 'taluk' && !taluks.length) throw new Error('Import the mandal/taluk catalogue before provisioning');
    const values = level === 'taluk' ? taluks.map(t=>({district_id:t.district_id,taluk_id:t.id,name:fpoName(`${t.name}_${t.district}`,t.state),created_by:actorId})) : districts.map(district => ({ district_id: district.id, taluk_id: null,
      name: fpoName(district.district,district.state), created_by: actorId }));
    const rows = values.length ? await tx`INSERT INTO digital_fpos ${tx(values,'district_id','taluk_id','name','created_by')}
      ON CONFLICT DO NOTHING RETURNING id` : [];
    const created = rows.length;
    await ensureDistrictTalukFpos(tx);
    const groups = await tx`INSERT INTO farmer_groups(digital_fpo_id)
      SELECT id FROM digital_fpos ORDER BY id
      ON CONFLICT(digital_fpo_id) DO NOTHING RETURNING id`;
    return { districts: districts.length, created, level, taluks:taluks.length, existing: values.length-created, groups_created: groups.length };
  });
}
