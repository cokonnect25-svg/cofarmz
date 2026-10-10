'use client';
import { useEffect, useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';
export default function TalukSelect({state,district,value,onChange,required=false}: {
 state:string;district:string;value:string;onChange:(id:string)=>void;required?:boolean;
}) {
 const [rows,setRows]=useState<Array<{id:string;name:string}>>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();setRows([]);setError('');setLoading(Boolean(district));
  if(district) fpoFetch(`/api/fpo-taluks?${new URLSearchParams({state,district})}`,{signal:controller.signal})
   .then(async r=>{if(!r.ok)throw new Error('Mandal/taluk list unavailable');return r.json();})
   .then(data=>{if(!controller.signal.aborted)setRows(data);})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[state,district]);
 return <label className="block text-sm">Mandal / Taluk
  <select aria-label="Mandal / Taluk" required={required} disabled={!district||loading} value={value} onChange={e=>onChange(e.target.value)} className="block w-full border rounded-xl p-3 bg-white">
   <option value="">{loading?'Loading...':required?'Select Mandal / Taluk':'Auto-detect Mandal / Taluk from saved address'}</option>
   {rows.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
  </select>
  {error&&<span role="alert" className="text-red-600">{error}</span>}
  {!loading&&!error&&district&&!rows.length&&<span className="text-gray-500">No taluks available. Import the locality catalogue first.</span>}
 </label>;
}
