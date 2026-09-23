'use client';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';
export default function DistrictSelect({state,district,onChange}: {state:string;district:string;onChange:(state:string,district:string)=>void}) {
  const [locations,setLocations] = useState<Array<{state:string;district:string}>>([]);
  const [error,setError] = useState('');
  useEffect(() => { fetch(getApiUrl('/api/fpo-locations')).then(async r => {if(!r.ok) throw new Error();setLocations(await r.json());}).catch(()=>setError('District list unavailable. Please try again.')); },[]);
  return <fieldset className="space-y-3 my-4"><legend className="font-semibold text-green-800">Farmer location</legend>
    {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
    <label className="block text-sm">State<select required aria-label="State" value={state} onChange={e=>onChange(e.target.value,'')} className="block w-full border rounded-xl p-3 bg-white"><option value="">Select State</option>{Array.from(new Set(locations.map(x=>x.state))).map(s=><option key={s}>{s}</option>)}</select></label>
    <label className="block text-sm">District<select required aria-label="District" value={district} disabled={!state} onChange={e=>onChange(state,e.target.value)} className="block w-full border rounded-xl p-3 bg-white"><option value="">Select District</option>{locations.filter(x=>x.state===state).map(d=><option key={d.district}>{d.district}</option>)}</select></label>
  </fieldset>;
}
