'use client';
import {useEffect,useState,useRef} from 'react';
import Link from 'next/link';
import {fpoFetch} from '@/lib/fpo-fetch';

export default function FpoHierarchy({fpoId,onOpen}:{fpoId:string;onOpen?:(id:string)=>void}) {
 const generation=useRef(0);
 const [data,setData]=useState<any>(null),[filter,setFilter]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [farmers,setFarmers]=useState<any[]>([]),[next,setNext]=useState<string|null>(null);
 useEffect(()=>{setFilter('');},[fpoId]);
 useEffect(()=>{
  generation.current++;
  const controller=new AbortController();setBusy(true);setError('');setData(null);setFarmers([]);setNext(null);
  fpoFetch(`/api/digital-fpos/${fpoId}/hierarchy?${new URLSearchParams({taluk:filter})}`,{cache:'no-store',signal:controller.signal})
   .then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);return d;})
   .then(d=>{if(!controller.signal.aborted){setData(d);setFarmers(d.farmers);setNext(d.next);}})
   .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
  return()=>controller.abort();
 },[fpoId,filter]);
 async function more(){
  const current=generation.current;
  setBusy(true);setError('');
  try {const r=await fpoFetch(`/api/digital-fpos/${fpoId}/hierarchy?${new URLSearchParams({taluk:filter,after:next || ''})}`,{cache:'no-store'});
   const d=await r.json();if(!r.ok)throw new Error(d.error);if(current!==generation.current)return;setFarmers(old=>[...old,...d.farmers]);setNext(d.next);
  }catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load farmers');}finally{if(current===generation.current)setBusy(false);}
 }
 return <section className="my-5 space-y-4 rounded-xl border border-green-100 p-4">
  <h3 className="text-lg font-bold text-green-900">{data?.fpo.taluk?'Mandal / Taluk farmers':'District and Mandal / Taluk overview'}</h3>
  {error&&<p role="alert" className="text-red-700">{error}</p>}
  {busy&&<p role="status">Loading farmers...</p>}
  {data&&<>
   <p className="text-sm text-gray-600">{data.fpo.district}, {data.fpo.state} · {data.totals.district_farmers} farmers{!data.fpo.taluk&&` · ${data.totals.unresolved_taluk} need mandal/taluk identification`}</p>
   {data.fpo.taluk&&data.parent&&onOpen&&<button className="text-sm font-bold text-green-700 underline" onClick={()=>onOpen(data.parent.id)}>Back to district FPO</button>}
   {!data.fpo.taluk&&<>
    <label className="block text-sm font-semibold">Farmer list<select aria-label="Filter district farmers by mandal/taluk" value={filter} onChange={e=>setFilter(e.target.value)} className="mt-2 block w-full rounded-xl border bg-white p-3">
     <option value="">All district farmers, including subgroups</option><option value="unresolved">Mandal / Taluk not identified</option>
     {data.subgroups.map((s:any)=><option key={s.taluk_id} value={s.taluk_id}>{s.taluk} ({s.farmer_count})</option>)}
    </select></label>
    <div className="grid gap-2 sm:grid-cols-2">{data.subgroups.map((s:any)=><div key={s.taluk_id} className="rounded-lg bg-green-50 p-3">
     <button className="font-bold text-green-800 underline" onClick={()=>setFilter(String(s.taluk_id))}>{s.taluk}</button>
     <p className="text-xs text-gray-600">{s.farmer_count} farmers · {s.status || 'Subgroup created automatically when a farmer is matched'}</p>
     {s.id&&onOpen&&<button className="mt-2 text-xs font-semibold underline" onClick={()=>onOpen(s.id)}>Open subgroup FPO</button>}
    </div>)}</div>
   </>}
   <h4 className="font-bold">{filter?'Farmers in selected Mandal / Taluk':'Farmers'}</h4>
   <ul className="divide-y">{farmers.map(f=><li key={f.id} className="py-3"><span className="font-semibold">{f.name}</span>
    <p className="text-xs text-gray-500">{f.taluk || 'Mandal / Taluk not identified'} · {f.fpo_name || 'Awaiting FPO assignment'} · {f.assignment_status.replaceAll('_',' ')}</p>
    {onOpen&&<Link href={`/farmer-profile?id=${encodeURIComponent(f.id)}`} className="text-xs font-bold text-green-700">View farmer profile</Link>}
   </li>)}</ul>
   {!busy&&!farmers.length&&<p className="text-sm text-gray-500">No farmers in this selection.</p>}
   {next&&<button disabled={busy} onClick={more} className="font-bold text-green-700 underline">Load more farmers</button>}
  </>}
 </section>;
}
