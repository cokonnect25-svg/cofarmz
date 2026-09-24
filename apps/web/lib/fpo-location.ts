import sql from '@/app/api/utils/sql';
import { FpoError } from './fpo-error';

export const locationKey = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '');
export const fpoName = (district: string, state: string) => `DigitalFPO_Cofarmz_${district.replace(/[^\p{L}\p{N}]/gu, '')}_${state.replace(/[^\p{L}\p{N}]/gu, '')}`;
export function validCoordinates(lat: unknown, lng: unknown) {
  const validNumber = (v: unknown) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
  return validNumber(lat) && validNumber(lng) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}
export async function validateDistrict(state: unknown, district: unknown, db: any = sql) {
  if (typeof state !== 'string' || typeof district !== 'string' || !state.trim() || !district.trim()) throw new FpoError('Select a valid State and District');
  const [row] = await db`SELECT * FROM fpo_districts WHERE lower(regexp_replace(state,'[^a-zA-Z0-9]','','g'))=${locationKey(state)} AND lower(regexp_replace(district,'[^a-zA-Z0-9]','','g'))=${locationKey(district)}`;
  if (!row) throw new FpoError('District does not belong to the selected State');
  return row;
}
type District = { id: string; state: string; district: string };
const addressWords = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const containsPlace = (address: string, place: string) => (` ${address} `).includes(` ${addressWords(place)} `);

// Match full place names, never partial substrings or a guessed nearest district.
export function matchProfileAddress(address: string, catalogue: District[]) {
  const normalized = addressWords(address);
  const states = [...new Set(catalogue.map(d => d.state))].filter(state => containsPlace(normalized,state));
  const candidates = catalogue.filter(d => containsPlace(normalized,d.district) &&
    (states.length ? states.includes(d.state) : normalized === addressWords(d.district)));
  if (states.length > 1 || candidates.length > 1) return { district: null, ambiguous: true };
  return { district: candidates[0] || null, ambiguous: false };
}

// Only saved profile address is considered. Device/Nearby coordinates never determine membership.
export async function resolveLegacyLocation(profile: any, catalogue?: District[]) {
  const address = String(profile.location || '').trim();
  const source = 'address';
  if (!address) return { district: null, source, reason: 'Saved profile address is missing; select State and District in your profile' };
  const rows = catalogue || await sql<District[]>`SELECT id,state,district FROM fpo_districts`;
  const match = matchProfileAddress(address,rows);
  if (match.district) return { district: match.district, source, reason: null };
  if (match.ambiguous) return { district: null, source, reason: 'Saved profile address matches multiple districts; select State and District in your profile' };
  if (!process.env.FPO_GEOCODER_URL) return { district: null, source, reason: 'District not identifiable from saved profile address; select State and District in your profile' };
  // A configured address resolver may resolve village/city addresses. No public-provider fallback.
  const url = new URL('search', process.env.FPO_GEOCODER_URL.replace(/\/?$/, '/'));
  url.searchParams.set('format','json'); url.searchParams.set('addressdetails','1');
  url.searchParams.set('accept-language','en'); url.searchParams.set('q',address);
  url.searchParams.set('countrycodes','in'); url.searchParams.set('limit','2');
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'CoFarmz district assignment', ...(process.env.FPO_GEOCODER_TOKEN ? { Authorization: `Bearer ${process.env.FPO_GEOCODER_TOKEN}` } : {}) }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) throw new Error('Geocoder unavailable');
    const results = await res.json();
    if (!Array.isArray(results) || !results.length) throw new Error('Location not resolved');
    const districts: any[] = [];
    for (const result of results) {
      const a = result.address;
      if (a?.country_code !== 'in' || !a.state || !(a.state_district || a.county)) throw new Error('District could not be resolved');
      districts.push(await validateDistrict(a.state, String(a.state_district || a.county).replace(/ district$/i,'')));
    }
    if (districts.some(d => d.id !== districts[0].id)) throw new Error('Address is ambiguous');
    return { district: districts[0], source, reason: null };
  } catch { return { district: null, source, reason: 'Saved address unresolved or provider unavailable; select State and District in your profile' }; }
}
