'use client';
import {useState} from 'react';
import {Building2,ChevronDown,ChevronRight,MapPin,Users} from 'lucide-react';
type Fpo={id:string;district_id:string|number;taluk_id?:string|number|null;taluk?:string|null;district:string;state:string;status:string;farmer_count:number;district_farmer_count:number};
export default function AdminFpoDirectory({fpos,search,status,level,state,busy,selectedId,onOpen}:{fpos:Fpo[];search:string;status:string;level:string;state:string;busy:boolean;selectedId?:string;onOpen:(id:string)=>void}) {
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 const matches=(f:Fpo)=>(status==='all'||f.status===status)&&(level==='all'||(level==='district'?!f.taluk_id:!!f.taluk_id))&&`${f.district} ${f.state} ${f.taluk||''}`.toLowerCase().includes(search.trim().toLowerCase());
 const districts=new Map<string,Fpo[]>();
 for(const f of fpos){if(state&&f.state!==state)continue;const key=String(f.district_id);districts.set(key,[...(districts.get(key)||[]),f]);}
 const groups=Array.from(districts.entries()).filter(([,rows])=>rows.some(matches)).sort((a,b)=>a[1][0].state.localeCompare(b[1][0].state)||a[1][0].district.localeCompare(b[1][0].district));
 const badge=(f:Fpo)=><span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${f.status==='active'?'bg-green-100 text-green-800':'bg-gray-100 text-gray-600'}`}>{f.status}</span>;
 return <div className="space-y-4">
  <p aria-live="polite" className="text-sm text-gray-500">{groups.length} districts ? Open a district to manage its mandal/taluk FPOs.</p>
  {!groups.length&&<div className="rounded-2xl border border-dashed bg-white p-10 text-center text-gray-500">{fpos.length?'No districts match these filters.':'Create a district FPO to get started.'}</div>}
  {groups.map(([key,rows])=>{const parent=rows.find(f=>!f.taluk_id);const location=parent||rows[0];const children=rows.filter(f=>f.taluk_id).sort((a,b)=>(a.taluk||'').localeCompare(b.taluk||''));const visible=children.filter(matches);const open=expanded[key]??!!(search.trim()||level==='taluk');return <section key={key} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
   <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-green-50 to-white p-5">
    <span className="rounded-2xl bg-white p-3 text-green-700 shadow-sm"><Building2 size={24}/></span>
    <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-widest text-green-700">District FPO</p><h3 className="text-lg font-bold text-gray-900">{location.district}</h3><p className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={12}/>{location.state}</p></div>
    {parent&&badge(parent)}
    {parent&&<button disabled={busy} aria-haspopup="dialog" onClick={()=>onOpen(parent.id)} className={`rounded-xl border px-4 py-2 text-sm font-bold text-green-800 disabled:opacity-50 ${selectedId===parent.id?'border-green-600 bg-green-100':'border-green-200 bg-white hover:bg-green-50'}`}>Manage district</button>}
   </div>
   <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-3">
    <p className="flex items-center gap-2 text-xs text-gray-600"><Users size={15}/>{location.district_farmer_count||0} district farmers <span className="text-gray-300">|</span> {children.length} mandal/taluk FPOs</p>
    <button aria-expanded={open} aria-controls={`taluks-${key}`} onClick={()=>setExpanded(old=>({...old,[key]:!open}))} className="inline-flex items-center gap-2 text-sm font-bold text-green-700">{open?'Hide':'View'} mandals / taluks<ChevronDown size={16} className={open?'rotate-180':''}/></button>
   </div>
   {open&&<div id={`taluks-${key}`} className="border-t border-gray-100 bg-gray-50/60 p-4">
    {!visible.length&&<p className="p-3 text-sm text-gray-500">{children.length?'No mandal/taluk FPOs match these filters.':'No mandal/taluk FPOs created in this district yet.'}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{visible.map(f=><button key={f.id} disabled={busy} aria-haspopup="dialog" onClick={()=>onOpen(f.id)} className={`rounded-xl border bg-white p-4 text-left transition hover:border-green-400 disabled:opacity-50 ${selectedId===f.id?'border-green-600 ring-1 ring-green-600':'border-gray-200'}`}>
     <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">Mandal / Taluk FPO</span>{badge(f)}</div>
     <h4 className="mt-2 font-bold text-gray-900">{f.taluk}</h4><div className="mt-3 flex items-center justify-between text-xs font-semibold text-green-700"><span>{f.farmer_count||0} assigned farmers</span><span className="inline-flex items-center">Manage<ChevronRight size={14}/></span></div>
    </button>)}</div>
   </div>}
  </section>;})}
 </div>;
}
