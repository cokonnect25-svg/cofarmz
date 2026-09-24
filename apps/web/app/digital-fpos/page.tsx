'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useAuth} from '@/hooks/useAuth';
import {getApiUrl} from '@/lib/api';
import AdminFpoGroup from '@/components/AdminFpoGroup';
import DistrictSelect from '@/components/DistrictSelect';

async function api(path:string,body?:any,method='POST') {
  const r=await fetch(getApiUrl(path),{credentials:'include',cache:'no-store',...(body?{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
}
export default function DigitalFposPage() {
  const {user}=useAuth();
  const [data,setData]=useState<any>({fpos:[],mine:null});
  const [messages,setMessages]=useState<any>({messages:[],unread:0});
  const [state,setState]=useState(''),[district,setDistrict]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [selected,setSelected]=useState<any>(null),[farmers,setFarmers]=useState<any[]>([]);
  const [farmerId,setFarmerId]=useState(''),[title,setTitle]=useState(''),[body,setBody]=useState('');
  const [cursor,setCursor]=useState<string|null>(''),[report,setReport]=useState<any[]>([]);
  const [farmerCursor,setFarmerCursor]=useState<string|null>(null),[filter,setFilter]=useState('pending=true');
  async function load(){const [d,m]=await Promise.all([api('/api/digital-fpos'),api('/api/digital-fpos/messages')]);setData(d);setMessages(m);}
  useEffect(()=>{if(user)load().catch(e=>setError(e.message));},[user]);
  async function run(fn:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await fn();await load();}catch(e:any){setError(e.message);}finally{setBusy(false);}}
  async function listFarmers(query:string,after='',append=false){const r=await api(`/api/admin/fpo?${query}&after=${encodeURIComponent(after)}`);setFilter(query);setFarmers(old=>append?[...old,...r.farmers]:r.farmers);setFarmerCursor(r.next);}
  return <main className="max-w-4xl mx-auto p-4 pb-24 space-y-5 text-gray-800">
    <Link href="/user-profile" className="text-green-700 underline">Back to profile</Link>
    <h1 className="text-2xl font-bold text-green-900">Digital FPOs</h1>
    {error&&<p role="alert" className="bg-red-50 text-red-700 p-3 rounded-xl">{error}</p>}{notice&&<p role="status" className="bg-green-50 p-3">{notice}</p>}
    {!data.can_review&&<><section className="bg-green-50 border border-green-200 rounded-2xl p-5"><h2 className="text-lg font-bold">My Digital FPO</h2><p className="break-words">{data.mine?.name||'Not Assigned'}</p><p>{data.mine?.district} {data.mine?.state}</p><p>{data.mine?.assignment_status?.replaceAll('_',' ')||'Location Required'}</p>{data.mine?.name&&<p className="break-words">Group: {data.mine.name}</p>}
      <DistrictSelect state={state} district={district} onChange={(s,d)=>{setState(s);setDistrict(d);}}/>
      <button disabled={busy||!district} onClick={()=>run(async()=>{await api('/api/users/profile',{userId:user.id,state,district},'PUT');setNotice('Location and assignment updated');})} className="bg-green-600 text-white rounded-xl px-4 py-2 disabled:opacity-50">Update my district</button>
    </section>
    <section className="border rounded-2xl p-5"><h2 className="font-bold">My Group updates · {messages.unread} unread</h2><p className="text-sm text-gray-500">Only your active group’s messages appear here.</p>
      {!!messages.messages.length&&<button className="text-green-700 underline" disabled={busy} onClick={()=>run(async()=>{await api('/api/digital-fpos/messages',{});})}>Mark as read</button>}
      {!messages.messages.length&&<p className="mt-3">No group updates.</p>}{messages.messages.map((m:any)=><article key={m.id} className="border-t py-3 mt-2"><h3 className="font-semibold">{m.title}</h3><p className="whitespace-pre-wrap">{m.body}</p><time className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</time></article>)}
    </section>
    </>}
    <section><h2 className="text-lg font-bold">{data.can_review ? "All Digital FPO groups" : "Other Digital FPOs"}</h2><p className="text-sm mb-3">Explore profiles. Viewing a profile does not join its group.</p><div className="grid sm:grid-cols-2 gap-3">{data.fpos.map((f:any)=><button key={f.id} className="text-left p-4 border rounded-2xl hover:bg-green-50" onClick={()=>run(async()=>setSelected(await api(`/api/digital-fpos/${f.id}`)))}><strong className="break-words">{f.name}</strong><p>{f.district}, {f.state}</p><p>{f.farmer_count} farmers · {f.status}{data.mine?.digital_fpo_id===f.id?' · My FPO':''}</p></button>)}</div></section>
    {selected&&<section className="border rounded-2xl p-5"><h2 className="font-bold break-words">{selected.name}</h2><p>{selected.district}, {selected.state}</p><p>Status: {selected.status}</p><p className="break-words">Group: {selected.group_name}</p><button onClick={()=>setSelected(null)} className="underline">Close profile</button>{data.can_review&&<AdminFpoGroup key={selected.group_id} groupId={selected.group_id}/>}</section>}
    {data.can_manage&&<section className="border border-green-300 rounded-2xl p-5 space-y-4"><h2 className="font-bold text-xl">Super Admin · Digital FPO management</h2><p>Select State and District to create an FPO or correct an assignment.</p>
      <DistrictSelect state={state} district={district} onChange={(s,d)=>{setState(s);setDistrict(d);}}/>
      <button disabled={busy||!district} className="bg-green-700 text-white px-4 py-2 rounded-xl disabled:opacity-50" onClick={()=>run(async()=>{await api('/api/digital-fpos',{state,district});setNotice('FPO and group created. Run assignment processing to enroll pending farmers.');})}>Create Digital FPO</button>
      {selected&&<div className="space-x-3"><button className="underline" disabled={busy} onClick={()=>run(async()=>{const f=await api('/api/digital-fpos',{id:selected.id,status:selected.status==='active'?'inactive':'active'},'PATCH');setSelected({...selected,...f});})}>{selected.status==='active'?'Deactivate':'Activate'} selected FPO</button><button className="underline" onClick={()=>run(()=>listFarmers(`group=${selected.group_id}`))}>View assigned farmers</button></div>}
      <button className="block underline text-green-800" disabled={busy} onClick={()=>run(()=>listFarmers('pending=true'))}>Farmers Pending Assignment</button>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Farmer</th><th>District</th><th>Status / reason</th></tr></thead><tbody>{farmers.map((f:any)=><tr key={f.id} className="border-t"><td><button className="underline text-green-700" onClick={()=>setFarmerId(f.id)}>{f.name}</button></td><td>{f.district||'Unknown'}</td><td>{f.assignment_status}<br/>{f.reason}</td></tr>)}</tbody></table></div>
      {farmerCursor&&<button className="underline" disabled={busy} onClick={()=>run(()=>listFarmers(filter,farmerCursor,true))}>Load more farmers</button>}
      <label className="block">Farmer ID for correction<input className="block border rounded-xl p-2 w-full" value={farmerId} onChange={e=>setFarmerId(e.target.value)}/></label><button disabled={busy||!farmerId||!district} className="underline disabled:opacity-50" onClick={()=>run(async()=>{await api('/api/admin/fpo',{action:'assign',farmer_id:farmerId,state,district});setNotice('Assignment corrected');})}>Assign to selected district</button>
      <div className="border-t pt-4"><h3 className="font-semibold">Existing farmer processing</h3><p>Processes 10 farmers per batch. Preview makes no changes.</p><div className="flex gap-4"><button disabled={busy||cursor===null} className="underline" onClick={()=>run(async()=>{const r=await api('/api/admin/fpo',{action:'process',after:cursor,dry_run:true});setReport(r.results);})}>Preview next batch</button><button disabled={busy||cursor===null} className="underline" onClick={()=>run(async()=>{const r=await api('/api/admin/fpo',{action:'process',after:cursor,dry_run:false});setReport(r.results);setCursor(r.next);})}>Process next batch</button><button className="underline" onClick={()=>setCursor('')}>Start again</button></div><p>{cursor===null?'All batches processed':'Ready for next batch'}</p><pre className="text-xs overflow-auto max-h-60">{report.length?JSON.stringify(report,null,2):''}</pre></div>
      {selected&&<form onSubmit={e=>{e.preventDefault();run(async()=>{await api('/api/admin/announcements',{title,body,groupId:selected.group_id});setTitle('');setBody('');setNotice('Group announcement saved');});}} className="space-y-3 border-t pt-4"><h3 className="font-bold break-words">Send to {selected.name}</h3><input aria-label="Announcement title" placeholder="Title" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} className="border rounded-xl p-3 w-full"/><textarea aria-label="Announcement message" placeholder="Message" required maxLength={10000} value={body} onChange={e=>setBody(e.target.value)} className="border rounded-xl p-3 w-full"/><button disabled={busy||selected.status!=='active'} className="bg-green-700 text-white rounded-xl px-4 py-2">Send group announcement</button></form>}
    </section>}
  </main>;
}
