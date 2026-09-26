export interface ReportFpo {
  id: string;
  group_id: string;
  name: string;
  state: string;
  district: string;
  status: string;
}

export interface ReportFarmer {
  id: string;
  name: string;
  group_id: string | null;
  assignment_status: string;
  location?: string | null;
  district?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  assignment_source?: string | null;
  reason?: string | null;
  profile_details?: {
    email?: string | null;
    phone?: string | null;
    gender?: string | null;
    age?: string | number | null;
    bio?: string | null;
    email_verified?: string | boolean | null;
    phone_verified?: string | boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
  } | null;
}

type ReadJson = (path: string) => Promise<any>;

// Follow every cursor: exports must not stop at the first 100 farmers.
export async function loadFpoReport(read: ReadJson, groupId?: string) {
  const directory = await read('/api/digital-fpos');
  if (!directory.can_review) throw new Error('Admin access required');
  const fpos: ReportFpo[] = directory.fpos.filter((f: ReportFpo) => !groupId || f.group_id === groupId);
  if (groupId && !fpos.length) throw new Error('This district FPO is no longer available');
  const groups = new Set(fpos.map(f => f.group_id));
  const farmers: ReportFarmer[] = [];
  const cursors = new Set<string>();
  let cursor: string | null = '';
  do {
    const params = new URLSearchParams({ after: cursor, details: 'true' });
    if (groupId) params.set('group', groupId);
    const page = await read(`/api/admin/fpo?${params}`);
    farmers.push(...page.farmers.filter((f: ReportFarmer) => f.group_id && groups.has(f.group_id)));
    cursor = page.next;
    if (cursor !== null) {
      if (cursors.has(cursor)) throw new Error('Unable to load the complete farmer list. Please retry.');
      cursors.add(cursor);
    }
  } while (cursor !== null);
  return { fpos, farmers };
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function renderFarmer(farmer: ReportFarmer, index: number) {
  const details = farmer.profile_details || {};
  const verified = (value: string | boolean | null | undefined) => value == null ? null : value === true || value === 'true' ? 'Yes' : 'No';
  const date = (value?: string | null) => value && !Number.isNaN(Date.parse(value)) ? new Date(value).toLocaleString('en-IN') : value;
  const fields: [string, unknown][] = [
    ['Farmer ID', farmer.id], ['Email', details.email], ['Phone number', details.phone],
    ['Address / location', farmer.location], ['District', farmer.district], ['State', farmer.state],
    ['Gender', details.gender], ['Age', details.age], ['Bio', details.bio],
    ['Latitude', farmer.latitude], ['Longitude', farmer.longitude],
    ['Email verified', verified(details.email_verified)], ['Phone verified', verified(details.phone_verified)],
    ['Profile created', date(details.created_at)], ['Profile updated', date(details.updated_at)],
    ['Assignment status', farmer.assignment_status?.replaceAll('_', ' ')],
    ['Assignment source', farmer.assignment_source?.replaceAll('_', ' ')], ['Assignment reason', farmer.reason],
  ];
  return `<article class="farmer"><h3>${index + 1}. ${escapeHtml(farmer.name || 'Unnamed farmer')}</h3><dl>${fields.map(([label, value]) => `<div class="field"><dt>${label}</dt><dd>${escapeHtml(value == null || value === '' ? 'Not provided' : value)}</dd></div>`).join('')}</dl></article>`;
}

export function renderFpoReport(fpos: ReportFpo[], farmers: ReportFarmer[], districtOnly: boolean, generatedAt = new Date()) {
  const title = districtOnly ? `${fpos[0]?.district || 'District'} Digital FPO` : 'All Digital FPOs';
  const grouped = new Map<string, ReportFarmer[]>();
  for (const farmer of farmers) {
    if (!farmer.group_id) continue;
    const members = grouped.get(farmer.group_id) || [];
    members.push(farmer);
    grouped.set(farmer.group_id, members);
  }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)} - Farmer report</title>
  <style>
    *{box-sizing:border-box}body{margin:0;color:#172b22;background:#f3f6f4;font:14px/1.5 Arial,sans-serif}
    main{max-width:1000px;margin:24px auto;padding:32px;background:white}h1{font-size:28px;margin:0 0 8px}h2{font-size:19px;margin:0}p{margin:6px 0}.muted{color:#53645b}.toolbar{padding:16px;background:#e8f5ec;border-radius:8px;margin-bottom:24px}
    button{background:#166534;color:white;border:0;border-radius:6px;padding:12px 20px;font:inherit;font-weight:bold;cursor:pointer}button:focus-visible{outline:3px solid #172b22;outline-offset:3px}
    .summary{padding:16px 0;border-bottom:2px solid #166534;margin-bottom:24px}.district{margin:24px 0}.district-header{break-inside:avoid;break-after:avoid;margin-bottom:10px}
    .farmer{margin:14px 0;border:1px solid #d4ded7;break-inside:avoid}.farmer h3{margin:0;padding:10px 14px;background:#edf5ef;font-size:15px;overflow-wrap:anywhere;break-after:avoid}.farmer dl{margin:0;padding:6px 14px}.field{display:grid;grid-template-columns:145px minmax(0,1fr);gap:12px;padding:5px 0;border-bottom:1px solid #edf1ee;break-inside:avoid}.field:last-child{border:0}dt{font-weight:bold}dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.empty{padding:14px;border:1px solid #d4ded7}
    @page{size:A4 portrait;margin:15mm} @media print{body{background:white;font-size:11px}main{max-width:none;margin:0;padding:0}.toolbar{display:none}h1{font-size:23px}h2{font-size:16px}table{font-size:10px}th,td{padding:7px}.district+.district{break-before:page}}
  </style></head><body><main>
  <div class="toolbar"><button type="button" onclick="window.print()">Save as PDF / Print</button><p>Select <strong>Save as PDF</strong> in the print dialog to download this report.</p></div>
  <h1>${escapeHtml(title)}</h1><p class="muted">CoFarmz - district communities and assigned farmers</p>
  <p class="muted">Generated: ${escapeHtml(generatedAt.toLocaleString('en-IN'))}</p>
  <div class="summary"><strong>${fpos.length} Digital FPO${fpos.length === 1 ? '' : 's'} | ${farmers.length} tagged farmers</strong><p>Includes active and inactive FPO memberships. Farmers without an FPO assignment are excluded.${districtOnly ? '' : ' Covers all districts, regardless of directory search or status filters.'}</p></div>
  ${!fpos.length ? '<p class="empty">No Digital FPOs available.</p>' : ''}
  ${fpos.map(fpo => {
    const members = grouped.get(fpo.group_id) || [];
    return `<section class="district"><div class="district-header"><h2>${escapeHtml(fpo.district)} Digital FPO</h2><p>${escapeHtml(fpo.state)} | Status: ${escapeHtml(fpo.status)} | ${members.length} tagged farmers</p><p class="muted">${escapeHtml(fpo.name)}</p></div>
    ${members.length ? members.map(renderFarmer).join('') : '<p class="empty">No assigned farmers.</p>'}</section>`;
  }).join('')}
  </main></body></html>`;
}
