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
type Subdistrict = { district_id: string; name: string };
// Retain combining marks in Indian scripts (vowel signs are part of the name).
export const addressWords = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const containsPlace = (address: string, place: string) => (` ${address} `).includes(` ${addressWords(place)} `);

function placeSpans(address: string, place: string) {
  const haystack=' '+address+' ',needle=' '+addressWords(place)+' ';
  const spans:number[][]=[];let offset=0,index;
  while((index=haystack.indexOf(needle,offset))!==-1) {
    spans.push([index,index+needle.length-2]);offset=index+1;
  }
  return spans;
}

function addressStates(normalized: string, catalogue: District[]) {
  return [...new Set(catalogue.map(d => d.state))].filter(state =>
    containsPlace(normalized,state) || containsPlace(normalized,addressWords(state).replace(/ /g,'')));
}

// Generate exact, whole-word phrases for an indexed lookup; never load the
// nationwide directory into application memory for every farmer.
export function addressPhrases(address: string) {
  const words = addressWords(address).split(' ').filter(Boolean);
  if (words.length > 80 || address.length > 2000) return [];
  const phrases = new Set<string>();
  for (let start=0;start<words.length;start++) {
    for (let end=start+1;end<=words.length;end++) phrases.add(words.slice(start,end).join(' '));
  }
  return [...phrases];
}

// Match full place names, never partial substrings or a guessed nearest district.
export function matchProfileAddress(address: string, catalogue: District[], subdistricts: Subdistrict[] = []) {
  const normalized = addressWords(address);
  const states = addressStates(normalized,catalogue);
  const stateSpans=states.flatMap(state=>[
    ...placeSpans(normalized,state),...placeSpans(normalized,addressWords(state).replace(/ /g,''))]);
  const outsideState=(name:string)=>placeSpans(normalized,name).some(([start,end])=>
    !stateSpans.some(([left,right])=>start>=left&&end<=right));
  const soleDistrict=states.length===1 && catalogue.filter(d=>d.state===states[0]).length===1;
  const candidates = catalogue.filter(d => (outsideState(d.district) ||
    (soleDistrict && addressWords(d.district)===addressWords(states[0]))) &&
    (states.length ? states.includes(d.state) : normalized === addressWords(d.district)));
  if (states.length > 1 || candidates.length > 1) return { district: null, ambiguous: true };
  const eligible = catalogue.filter(d => states.includes(d.state));
  const eligibleIds = new Set(eligible.map(d=>String(d.id)));
  const places = new Map<string,Set<string>>();
  if(states.length === 1) for(const place of subdistricts) {
    const key=addressWords(place.name);
    if (!key || !eligibleIds.has(String(place.district_id)) || !outsideState(key)) continue;
    // The state name alone is not evidence of a particular locality.
    if (addressWords(states[0])===key || addressWords(states[0]).replace(/ /g,'')===key) continue;
    if(!places.has(key))places.set(key,new Set());
    places.get(key)!.add(String(place.district_id));
  }
  // Prefer a full name over a nested fragment, e.g. "Rampur Kalan" over "Rampur".
  const names=[...places.keys()].filter(name=>![...places.keys()].some(other=>other!==name&&containsPlace(other,name)));
  const evidence=names.map(name=>places.get(name)!);
  if(candidates.length) evidence.push(new Set(candidates.map(d=>String(d.id))));
  if(!evidence.length)return { district:null, ambiguous:false };
  const remaining=[...evidence[0]].filter(id=>evidence.every(ids=>ids.has(id)));
  if(remaining.length!==1)return { district:null, ambiguous:true };
  return { district:catalogue.find(d=>String(d.id)===remaining[0]) || null, ambiguous:false };
}

// Only saved profile address is considered. Device/Nearby coordinates never determine membership.
export async function resolveLegacyLocation(profile: any, catalogue?: District[]) {
  const address = String(profile.location || '').trim();
  const source = 'address';
  if (!address) return { district: null, source, reason: 'Saved profile address is missing; select State and District in your profile' };
  const rows = catalogue || await sql<District[]>`SELECT id,state,district FROM fpo_districts`;
  const subdistricts = await sql<Subdistrict[]>`SELECT district_id,name FROM fpo_subdistricts`;
  const states=addressStates(addressWords(address),rows);
  const phrases=addressPhrases(address);
  const stateDistrictIds=rows.filter(d=>states.includes(d.state)).map(d=>d.id);
  const localities=states.length===1 && phrases.length
    ? await sql<Subdistrict[]>`SELECT DISTINCT district_id,name FROM fpo_localities
        WHERE name_key=ANY(${phrases}::text[]) AND district_id=ANY(${stateDistrictIds}::bigint[])`
    : [];
  const match = matchProfileAddress(address,rows,[...subdistricts,...localities]);
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
