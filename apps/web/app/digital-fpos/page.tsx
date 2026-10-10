'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft, ChevronRight, CircleHelp, Plus, Search} from 'lucide-react';
import {useAuth} from '@/hooks/useAuth';
import { fpoFetch } from '@/lib/fpo-fetch';
import FpoBackfill from '@/components/FpoBackfill';
import AdminFpoGroup from '@/components/AdminFpoGroup';
import FpoProfileEditor from '@/components/FpoProfileEditor';
import FpoGroupDialog from '@/components/FpoGroupDialog';
import FarmerFpo from '@/components/FarmerFpo';
import FpoHierarchy from '@/components/FpoHierarchy';
import TalukSelect from '@/components/TalukSelect';
import DistrictSelect from '@/components/DistrictSelect';
import FpoPdfExport from '@/components/FpoPdfExport';
import AdminFpoDirectory from '@/components/AdminFpoDirectory';
import FpoCredentials from '@/components/FpoCredentials';

async function api(path:string,body?:any,method='POST') {
  const r=await fpoFetch(path,{credentials:'include',cache:'no-store',...(body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
}
export default function DigitalFposPage() {
  const {user,loading:authLoading}=useAuth();
  const [groupOpen,setGroupOpen]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [reviewVersion,setReviewVersion]=useState(0);
  const [data,setData]=useState<any>({fpos:[],mine:null});
  const [search,setSearch]=useState(''),[showCreate,setShowCreate]=useState(false);
  const [level,setLevel]=useState('district'),[taluk,setTaluk]=useState('');
  const [directoryLevel,setDirectoryLevel]=useState('all');
  const [directoryState,setDirectoryState]=useState('');
  const [detailTab,setDetailTab]=useState('farmers');
  const [statusFilter,setStatusFilter]=useState('all');
  const [state,setState]=useState(''),[district,setDistrict]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<any>(null),[farmers,setFarmers]=useState<any[]>([]);
  const [farmerId,setFarmerId]=useState(''),[title,setTitle]=useState(''),[body,setBody]=useState('');
  const [farmerCursor,setFarmerCursor]=useState<string|null>(null),[filter,setFilter]=useState('pending=true');
  async function load(){const d=await api('/api/digital-fpos');setData(d);setLoaded(true);setReviewVersion(v=>v+1);}
  useEffect(()=>{if(user)load().catch(e=>setError(e.message));},[user]);
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  async function listFarmers(query:string,after='',append=false){const r=await api(`/api/admin/fpo?${query}&after=${encodeURIComponent(after)}`);setFilter(query);setFarmers(old=>append?[...old,...r.farmers]:r.farmers);setFarmerCursor(r.next);}
  if (!authLoading && !user) return <main className="mx-auto max-w-xl p-6 text-center"><h1 className="text-xl font-bold">Digital FPOs</h1><p className="my-4 text-gray-500">Sign in to view your district community.</p><Link href="/login" className="font-bold text-brand-700">Sign in</Link></main>;
  if (!loaded) return <main className="mx-auto max-w-4xl p-6"><p role="status">{error || 'Loading Digital FPOs...'}</p>{error&&<button className="mt-3 font-bold text-brand-700" onClick={()=>{setError('');load().catch(e=>setError(e.message));}}>Try again</button>}</main>;

  if (!data.can_review) return <main className="p-4 pb-24"><Link className="inline-flex mb-4 text-sm font-bold text-brand-700" href="/nearby-farmers?type=fpo">Back to Nearby FPOs</Link><FarmerFpo mode="directory"/></main>;
  return <main className="max-w-6xl mx-auto p-4 sm:p-6 pb-24 space-y-5 text-gray-800">
    <Link href={data.can_manage?"/admin/dashboard":"/user-profile"} className="inline-flex items-center gap-2 text-sm font-bold text-gray-500"><ArrowLeft size={18}/>{data.can_manage?"Back to dashboard":"Back to profile"}</Link>
    <header><p className="text-xs font-bold uppercase tracking-widest text-brand-700">Community management</p><h1 className="mt-1 text-3xl font-black text-gray-900">Digital FPOs</h1><p className="mt-2 text-sm text-gray-500">Manage district and mandal/taluk communities and keep track of farmer assignments.</p></header>
    <FpoPdfExport/>
    <details className="group rounded-2xl border border-gray-100 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 p-5 text-sm font-bold text-gray-800 [&::-webkit-details-marker]:hidden"><CircleHelp size={18} className="text-green-600"/>How to use this page<ChevronRight size={16} className="ml-auto transition-transform group-open:rotate-90"/></summary>
      <div className="border-t border-gray-100 p-5"><p className="mb-4 text-sm leading-relaxed text-gray-500">Start by creating a district FPO, then open its card to review farmers and announcements. Farmers join according to their saved State, District and Mandal/Taluk.</p>
        <dl className="grid gap-4 sm:grid-cols-2">{[
          ['Overview totals','Digital FPOs counts all created FPOs. Active counts enabled FPOs. Tagged farmers counts stored memberships, including those in inactive FPOs.'],
          ['Create FPO','Choose State and District, then the FPO level. For Mandal / Taluk, select the subdistrict. Matching saved profiles are enrolled automatically.'],
          ['Search and status filter','Find an FPO by name, district or state, or show only active or inactive FPOs. These filters only change the list you see.'],
          ['FPO cards and group overview','Open a card to see its tagged farmers and announcement history in a popup. Load more brings in the next page of results.'],
          ...(data.can_manage?[
            ['Pending farmers and correction','Find farmers without active group access. Click a farmer name to fill the correction field, choose the correct State/District and assign. This updates their saved district and group.'],
            ['Preview and assign','Preview all farmers checks saved profiles without changing them. Assign from saved profiles applies the matches. Missing FPOs or unclear locations remain pending.'],
            ['Activate or deactivate','Deactivation immediately stops farmer access to this FPO group. Reactivation restores eligible members; process saved profiles again if assignments are pending.'],
            ['Group announcement','Select an FPO, enter a title and message, then send an update to that active group. Only its eligible assigned farmers receive it.'],
          ]:[]),
        ].map(([label,description])=><div key={label} className="rounded-xl bg-gray-50 p-4"><dt className="text-sm font-bold text-gray-800">{label}</dt><dd className="mt-1 text-xs leading-relaxed text-gray-500">{description}</dd></div>)}</dl>
        <p className="mt-4 text-xs text-gray-500">Admin accounts can create FPOs and review groups. Assignment corrections, processing, activation and publishing are available to Super Admin.</p>
      </div>
    </details>
    {error&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl">{error}</p>}{notice&&<p role="status" className="bg-green-50 p-3">{notice}</p>}
    <div className="grid grid-cols-3 gap-3">{[
      ['District FPOs',data.fpos.filter((f:any)=>!f.taluk_id).length],['Mandal / Taluk FPOs',data.fpos.filter((f:any)=>f.taluk_id).length],['Assigned farmers',data.fpos.reduce((total:number,f:any)=>total+Number(f.farmer_count||0),0)]
    ].map(([label,value])=><div key={label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-soft"><p className="text-2xl font-black text-brand-800">{value}</p><p className="mt-1 text-xs text-gray-500">{label}</p></div>)}</div>
    <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-gray-900">District and Mandal / Taluk FPOs</h2><p className="text-sm text-gray-500">Open a district, then manage its mandal/taluk FPOs, farmers and login accounts.</p></div>{data.can_create&&<button onClick={()=>setShowCreate(!showCreate)} aria-expanded={showCreate} aria-controls="create-fpo" className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-bold text-white"><Plus size={17}/>{showCreate?'Close creation':'Create FPO'}</button>}</div>
      {data.can_create&&showCreate&&<section id="create-fpo" className="rounded-2xl border border-brand-200 bg-brand-50 p-5 space-y-3"><h3 className="font-bold text-brand-900">Create a Digital FPO</h3><p className="text-sm text-gray-600">Create a district FPO or a mandal/taluk FPO within its district. Farmers join their mandal/taluk FPO. District FPOs provide the management overview. Farmers without a mandal/taluk remain pending.</p><DistrictSelect state={state} district={district} onChange={(s,d)=>{setState(s);setDistrict(d);setTaluk('');}}/><label className="block text-sm">FPO level<select aria-label="FPO level" value={level} onChange={e=>{setLevel(e.target.value);setTaluk('');}} className="block w-full border rounded-xl p-3 bg-white"><option value="district">District</option><option value="taluk">Mandal / Taluk</option></select></label>{level==='taluk'&&<TalukSelect state={state} district={district} value={taluk} onChange={setTaluk} required/>}<button disabled={busy||!district||(level==='taluk'&&!taluk)} className="bg-brand-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50" onClick={()=>run(async()=>{const created=await api('/api/digital-fpos',{state,district,taluk_id:level==='taluk'?taluk:null});setSelected(await api(`/api/digital-fpos/${created.id}`));setGroupOpen(true);setShowCreate(false);setNotice(`Digital FPO created. ${created.assigned_count || 0} matching farmers were enrolled. Process saved profiles to resolve older addresses.`);})}>{busy?'Creating...':'Create Digital FPO'}</button></section>}
      <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search size={18} className="absolute left-3 top-3 text-gray-400"/><input aria-label="Search FPOs" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search district or mandal/taluk" className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm"/></label><select aria-label="Filter districts by state" value={directoryState} onChange={e=>setDirectoryState(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="">All states</option>{Array.from(new Set<string>(data.fpos.map((f:any)=>f.state))).sort().map(value=><option key={value}>{value}</option>)}</select><select aria-label="Filter by FPO level" value={directoryLevel} onChange={e=>setDirectoryLevel(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="district">District FPOs</option><option value="taluk">Mandal / Taluk FPOs</option><option value="all">All FPOs</option></select><select aria-label="Filter by FPO status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      <AdminFpoDirectory fpos={data.fpos} search={search} status={statusFilter} level={directoryLevel} state={directoryState} busy={busy} selectedId={selected?.id} onOpen={id=>run(async()=>{setSelected(await api(`/api/digital-fpos/${id}`));setDetailTab('farmers');setGroupOpen(true);})}/>

    </section>
    {selected&&groupOpen&&<FpoGroupDialog title={`${selected.taluk || selected.district} Digital FPO`} onClose={()=>setGroupOpen(false)}><p className="text-sm text-gray-500">{selected.district}, {selected.state}</p><p className="mt-2 text-sm capitalize">Status: {selected.status}</p><p className="mt-2 break-words text-xs text-gray-500">{selected.group_name}</p><div role="tablist" aria-label="FPO management" className="my-4 flex flex-wrap gap-2 rounded-xl bg-gray-100 p-2">{[['farmers','Farmers & subgroups'],['login','Login & password'],['profile','Contact details'],['updates','Group updates']].map(([value,label])=><button key={value} role="tab" aria-selected={detailTab===value} aria-controls="fpo-detail-panel" id={`fpo-tab-${value}`} onClick={()=>setDetailTab(value)} className={`rounded-lg px-3 py-2 text-sm font-bold ${detailTab===value?'bg-white text-green-800 shadow-sm':'text-gray-500'}`}>{label}</button>)}</div><div role="tabpanel" id="fpo-detail-panel" aria-labelledby={`fpo-tab-${detailTab}`}>
      {detailTab==='farmers'&&<FpoHierarchy key={`hierarchy:${selected.id}:${reviewVersion}`} fpoId={selected.id} onOpen={id=>run(async()=>{setSelected(await api(`/api/digital-fpos/${id}`));})}/>}
      {detailTab==='login'&&<FpoCredentials key={selected.id} fpoId={selected.id}/>}
      {detailTab==='profile'&&<FpoProfileEditor key={selected.id} profile={selected} onSaved={contact=>setSelected((current:any)=>({...current,...contact}))}/>}
      {detailTab==='updates'&&<AdminFpoGroup key={`${selected.group_id}:${reviewVersion}`} groupId={selected.group_id}/>}
    </div></FpoGroupDialog>}
    {data.can_manage&&<details className="border border-gray-100 bg-white shadow-soft rounded-2xl p-5 space-y-4"><summary className="cursor-pointer font-bold text-green-900">Assignment and publishing tools <span className="ml-2 text-xs font-normal text-gray-500">Super Admin</span></summary><div><span className="rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-black uppercase text-green-700">Super Admin</span><h2 className="mt-3 font-bold text-xl">Assignment and publishing tools</h2><p className="mt-1 text-sm text-gray-500">The selected FPO controls status and announcements. The State/District below is the destination for an individual farmer correction.</p></div><h3 className="text-sm font-bold text-gray-800">Correction destination</h3>
      <DistrictSelect state={state} district={district} onChange={(s,d)=>{setState(s);setDistrict(d);setTaluk('');}}/>

      {selected&&<div className="space-x-3"><button className="underline" disabled={busy} onClick={()=>run(async()=>{const f=await api('/api/digital-fpos',{id:selected.id,status:selected.status==='active'?'inactive':'active'},'PATCH');setSelected({...selected,...f});})}>{selected.status==='active'?'Deactivate':'Activate'} selected FPO</button><button className="underline" aria-haspopup="dialog" onClick={()=>setGroupOpen(true)}>View assigned farmers</button></div>}
      <TalukSelect state={state} district={district} value={taluk} onChange={setTaluk}/><p className="text-xs text-gray-500">Pending farmers need a saved district, a district FPO, or an active group. Select a farmer name below to fill their ID for correction.</p>
      <button className="block underline text-green-800" disabled={busy} onClick={()=>run(()=>listFarmers('pending=true'))}>Farmers Pending Assignment</button>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Farmer</th><th>District</th><th>Status / reason</th></tr></thead><tbody>{farmers.map((f:any)=><tr key={f.id} className="border-t"><td><button className="underline text-green-700" onClick={()=>setFarmerId(f.id)}>{f.name}</button></td><td>{f.district||'Unknown'}</td><td>{f.assignment_status}<br/>{f.reason}</td></tr>)}</tbody></table></div>
      {farmerCursor&&<button className="underline" disabled={busy} onClick={()=>run(()=>listFarmers(filter,farmerCursor,true))}>Load more farmers</button>}
      <label className="block">Farmer ID for correction<input className="block border rounded-xl p-2 w-full" value={farmerId} onChange={e=>setFarmerId(e.target.value)}/></label><button disabled={busy||!farmerId||!district} className="underline disabled:opacity-50" onClick={()=>run(async()=>{await api('/api/admin/fpo',{action:'assign',farmer_id:farmerId,state,district,taluk_id:taluk || null});setNotice('Assignment corrected');})}>Assign to selected location</button>
      <FpoBackfill onComplete={load}/>
      {selected&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('/api/admin/announcements',{title,body,groupId:selected.group_id});setTitle('');setBody('');setNotice('Group announcement saved');});}} className="space-y-3 border-t pt-4"><h3 className="font-bold break-words">Announcement to {selected.taluk || selected.district} Digital FPO</h3><p className="text-sm text-gray-500">This message appears in the group feed for assigned farmers and sends a notification to eligible members.</p><input aria-label="Announcement title" placeholder="Title" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="border rounded-xl p-3 w-full"/><textarea aria-label="Announcement message" placeholder="Message" required maxLength={10000} value={body} onChange={e=>setBody(e.target.value)} className="border rounded-xl p-3 w-full"/><button disabled={busy||selected.status!=='active'} className="bg-green-700 text-white rounded-xl px-4 py-2">Send group announcement</button></form>}
    </details>}
  </main>;
}
