import sql from '@/app/api/utils/sql';
import { FpoError } from './fpo-access';

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
// A configured Nominatim-compatible provider is required for bulk geocoding.
// Never silently send farmer locations to an unconfigured public service.
export async function resolveLegacyLocation(profile: any) {
  const coordinates = validCoordinates(profile.latitude, profile.longitude);
  const address = String(profile.location || '').trim();
  if (!coordinates && address.length < 5) return { district: null, source: 'profile_update', reason: 'Missing usable coordinates and address' };
  const source = coordinates ? 'latitude_longitude' : 'address';
  if (!process.env.FPO_GEOCODER_URL) return { district: null, source, reason: 'Location resolver is not configured' };
  const url = new URL(coordinates ? 'reverse' : 'search', process.env.FPO_GEOCODER_URL.replace(/\/?$/, '/'));
  url.searchParams.set('format', 'json'); url.searchParams.set('addressdetails','1');
  url.searchParams.set('accept-language','en');
  if (coordinates) { url.searchParams.set('lat',String(profile.latitude)); url.searchParams.set('lon',String(profile.longitude)); }
  else { url.searchParams.set('q',address); url.searchParams.set('countrycodes','in'); url.searchParams.set('limit','2'); }
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'CoFarmz district assignment', ...(process.env.FPO_GEOCODER_TOKEN ? { Authorization: `Bearer ${process.env.FPO_GEOCODER_TOKEN}` } : {}) }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (!res.ok) throw new Error('Geocoder unavailable');
    const data = await res.json();
    const results = coordinates ? [data] : data;
    if (!Array.isArray(results) || !results.length) throw new Error('Location not resolved');
    const districts: any[] = [];
    for (const result of results) {
      const a = result.address;
      if (a?.country_code !== 'in' || !a.state || !(a.state_district || a.county)) throw new Error('District could not be resolved');
      districts.push(await validateDistrict(a.state, String(a.state_district || a.county).replace(/ district$/i,'')));
    }
    if (districts.some(d => d.id !== districts[0].id)) throw new Error('Address is ambiguous');
    return { district: districts[0], source, reason: null };
  } catch { return { district: null, source, reason: 'Location unresolved or provider unavailable; manual review required' }; }
}
