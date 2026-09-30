'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, MapPin, MessageCircle } from 'lucide-react';
import { fpoFetch } from '@/lib/fpo-fetch';
import { useAuth } from '@/hooks/useAuth';
import { readFpoCache, writeFpoCache } from '@/lib/fpo-cache';

export default function MyDigitalFpo() {
  const { user } = useAuth();
  const userId = user?.id;
  const [cached,setCached]=useState(false);
  const [owner,setOwner]=useState<string | null>(null);
  const [mine,setMine]=useState<any>(null);
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if (!userId) return;
    const controller=new AbortController();
    const saved=readFpoCache(userId);
    setOwner(userId);setMine(saved?.mine ?? null);setCached(!!saved);
    setLoading(!saved);setError('');
    fpoFetch('/api/digital-fpos',{cache:'no-store',signal:controller.signal})
      .then(async r=>{
        if(!r.ok) throw new Error(r.status===401 ? 'Your session needs renewal. Sign in to refresh your FPO.' : 'Unable to refresh your Digital FPO.');
        const data=await r.json();
        if(!controller.signal.aborted){setMine(data.mine);setCached(false);writeFpoCache(userId,data.mine);}
      })
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[userId,retry]);
  useEffect(()=>{
    const refresh=()=>setRetry(n=>n+1);
    const visible=()=>{if(document.visibilityState==='visible')refresh();};
    window.addEventListener('online',refresh);
    document.addEventListener('visibilitychange',visible);
    return ()=>{window.removeEventListener('online',refresh);document.removeEventListener('visibilitychange',visible);};
  },[]);
  if(!userId || owner!==userId) return null;
  const assigned=mine?.assignment_status==='assigned';
  const status=assigned?'Group assigned':mine?.assignment_status==='inactive_fpo'?'Group temporarily inactive':mine?.assignment_status==='pending_fpo'?'Awaiting district FPO':'Location needed';
  return <section className="m-4 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
    <div className="flex items-start gap-3 p-5"><span className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 size={24}/></span><div className="min-w-0 flex-1"><h2 className="text-xs font-bold uppercase tracking-widest text-brand-700">My Digital FPO</h2>
      {loading?<p role="status" className="mt-2 text-sm text-gray-400">Loading your community...</p>:error&&!cached?<div role="alert" className="mt-2 text-sm text-red-700"><p>{error}</p><button onClick={()=>setRetry(n=>n+1)} className="mt-2 font-bold">Try again</button></div>:<>
        <p className="mt-1 font-bold text-gray-900">{mine?.district?`${mine.district} Digital FPO`:'Your district community'}</p>
        {mine?.district&&<p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={12}/>{mine.district}, {mine.state}</p>}
        <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${assigned?'bg-brand-50 text-brand-700':'bg-amber-50 text-amber-700'}`}>{status}</span>
        {!assigned&&<p className="mt-2 text-xs leading-relaxed text-gray-500">{mine?.assignment_status==='pending_fpo'?'Your district is saved. An admin will set up your FPO group.':mine?.assignment_status==='inactive_fpo'?'Your group will reappear in Messages when it is active again.':'Add your state and district in your profile to find your FPO group.'}</p>}
      </>}
      {cached&&<p role="status" className="mt-2 text-xs text-gray-500">Saved FPO details{error?' ? could not refresh.': ' ? refreshing?'}</p>}
      {cached&&error&&<button onClick={()=>setRetry(n=>n+1)} className="mt-2 text-xs font-bold text-brand-700">Refresh details</button>}
    </div></div>
    {!loading&&(!error||cached)&&<div className="flex flex-wrap gap-3 border-t border-brand-50 px-5 py-3">{assigned&&<Link href="/fpo-group" className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-700"><MessageCircle size={16}/>Open group<ChevronRight size={15}/></Link>}<Link href="/nearby-farmers?type=fpo" className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-gray-500">Explore FPOs<ChevronRight size={15}/></Link></div>}
  </section>;
}
