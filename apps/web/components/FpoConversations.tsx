'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { fpoFetch } from '@/lib/fpo-fetch';
type Thread = { fpo_id:string; farmer_id:string; name:string; farmer_name:string; body:string; created_at:string; from_fpo:boolean };
export default function FpoConversations({ query = '' }: { query?: string }) {
  const { user } = useAuth();
  const userId=user?.id;
  const reviewer=['admin','superadmin','super_admin'].includes(user?.role);
  const allowed=user?.role==='farmer'||reviewer;
  const [threads,setThreads]=useState<Thread[]>([]);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [offset,setOffset]=useState(0);
  const [next,setNext]=useState<number|null>(null);
  const [version,setVersion]=useState(0);
  useEffect(()=>{setThreads([]);setOffset(0);},[userId]);
  useEffect(()=>{
    if(!userId||!allowed)return;
    const controller=new AbortController();setBusy(true);setError('');
    fpoFetch(`/api/digital-fpos/conversations?offset=${offset}`,{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to load FPO conversations');return data;})
      .then(data=>{if(!controller.signal.aborted){setThreads(old=>offset?[...old,...data.threads]:data.threads);setNext(data.next);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[userId,allowed,offset,version]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==='visible'){setOffset(0);setVersion(v=>v+1);}};
    const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[]);
  if(!allowed)return null;
  const visible=threads.filter(t=>`${t.name} ${reviewer?t.farmer_name:''} ${t.body}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="mx-6 mb-4 rounded-2xl border border-brand-100 bg-white p-4">
    <div className="flex items-center justify-between"><h2 className="font-bold">FPO conversations</h2><button disabled={busy} onClick={()=>{setOffset(0);setVersion(v=>v+1);}} className="text-sm font-bold text-brand-700">Refresh</button></div>
    {error&&<p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {busy&&<p role="status" className="text-sm text-gray-500">Updating conversations…</p>}
    {!busy&&!error&&!threads.length&&<p className="mt-2 text-sm text-gray-500">Messages you send to any FPO will appear here.</p>}
    {visible.map(t=><Link key={`${t.fpo_id}:${t.farmer_id}`} href={`/fpo-conversation?fpoId=${encodeURIComponent(t.fpo_id)}${reviewer?`&farmerId=${encodeURIComponent(t.farmer_id)}`:''}`} className="block border-t py-3 mt-2">
      <p className="font-bold text-brand-700">{t.name}{reviewer?` · ${t.farmer_name}`:''}</p><p className="truncate text-sm text-gray-600">{t.from_fpo?'FPO':reviewer?t.farmer_name:'You'}: {t.body}</p><time className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString()}</time>
    </Link>)}
    {next!==null&&<button disabled={busy} onClick={()=>setOffset(next)} className="text-sm font-bold text-brand-700">Load more conversations</button>}
  </section>;
}
