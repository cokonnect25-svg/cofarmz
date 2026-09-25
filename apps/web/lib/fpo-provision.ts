import sql from '@/app/api/utils/sql';
import { fpoName } from './fpo-location';

// Provision the catalogue atomically; membership processing uses separate,
// retryable farmer transactions so a bad profile cannot block provisioning.
export async function provisionCatalogue(actorId: string) {
  return sql.begin(async tx => {
    const districts = await tx`SELECT id,state,district FROM fpo_districts ORDER BY id`;
    const values = districts.map(district => ({ district_id: district.id,
      name: fpoName(district.district,district.state), created_by: actorId }));
    const rows = values.length ? await tx`INSERT INTO digital_fpos ${tx(values,'district_id','name','created_by')}
      ON CONFLICT(district_id) DO NOTHING RETURNING id` : [];
    const created = rows.length;
    const groups = await tx`INSERT INTO farmer_groups(digital_fpo_id)
      SELECT id FROM digital_fpos ORDER BY id
      ON CONFLICT(digital_fpo_id) DO NOTHING RETURNING id`;
    return { districts: districts.length, created, existing: districts.length-created, groups_created: groups.length };
  });
}
