'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import FpoGroupChat from '@/components/FpoGroupChat';
import FpoProfileActions from '@/components/FpoProfileActions';
import type { FpoContact } from '@/lib/fpo-profile';
import { ArrowLeft, ArrowUpRight, Building2, CheckCheck, ChevronRight, MapPin, MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fpoFetch } from '@/lib/fpo-fetch';

type Profile = FpoContact & { id: string; name: string; state: string; district: string; taluk?: string; status: string };
type Assignment = { name: string; digital_fpo_id: string; assignment_status: string; district: string; taluk?: string; state: string };
type Update = { id: string; title: string; body: string; created_at: string };
async function request(path: string, read = false, signal?: AbortSignal) {
  const response = await fpoFetch(path, { credentials: 'include', cache: 'no-store', signal,
    ...(read ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load Digital FPOs');
  return data;
}
const title = (fpo: { district?: string; taluk?: string; name?: string }) => fpo.district ? `${fpo.taluk || fpo.district} Digital FPO` : fpo.name || 'My Digital FPO';

export default function FarmerFpo({ mode }: { mode: 'directory' | 'group' | 'thread' }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [fpos, setFpos] = useState<Profile[]>([]);
  const [mine, setMine] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [open, setOpen] = useState(mode !== 'directory');
  useEffect(()=>{if(new URLSearchParams(window.location.search).get('fpoGroup')==='1')setOpen(true);},[]);
  const [messages, setMessages] = useState<Update[]>([]);
  const [unread, setUnread] = useState(0);
  const [replyTo, setReplyTo] = useState<{ title: string; sequence: number } | null>(null);
  useEffect(() => { setReplyTo(null); }, [userId, mine?.digital_fpo_id]);
  const [announcementError, setAnnouncementError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [retry, setRetry] = useState(0);
  const [marking, setMarking] = useState(false);
  const [profileLoading, setProfileLoading] = useState<string | null>(null);
  const profileRequest = useRef(0);
  const profileHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setMine(null); setSelected(null); setMessages([]);
    profileRequest.current += 1;
    let fetching = false;
    async function load() {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        const data = await request('/api/digital-fpos', false, controller.signal);
        // The farmer chat must remain available if the announcement feed fails.
        let feed = { messages: [], unread: 0 };
        let feedError = '';
        if (mode !== 'directory' && data.mine?.assignment_status === 'assigned') {
          try { feed = await request('/api/digital-fpos/messages', false, controller.signal); }
          catch { feedError = 'Announcements could not be refreshed.'; }
        }
        if (!controller.signal.aborted) {
          setAnnouncementError(feedError); setFpos(data.fpos); setMine(data.mine); setMessages(feed.messages); setUnread(feed.unread); setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Unable to load Digital FPOs');
          setMessages([]); setMine(null); setFpos([]); setSelected(null);
        }
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    const timer = mode !== 'directory' ? setInterval(load, 30000) : null;
    return () => { controller.abort(); profileRequest.current += 1; if (timer) clearInterval(timer); };
  }, [userId, mode, retry]);

  useEffect(() => { if (selected) profileHeading.current?.focus(); }, [selected]);

  async function openProfile(fpo: Profile) {
    const sequence = ++profileRequest.current;
    setProfileLoading(fpo.id); setError('');
    try {
      const profile = await request(`/api/digital-fpos/${fpo.id}`);
      if (sequence === profileRequest.current) setSelected(profile);
    } catch (e) { if (sequence === profileRequest.current) setError(e instanceof Error ? e.message : 'Unable to load profile'); }
    finally { if (sequence === profileRequest.current) setProfileLoading(null); }
  }

  if (!userId) return null;
  if (loading) return <div role="status" aria-label="Loading Digital FPOs" className="mx-6 my-4 space-y-3 animate-pulse"><div className="h-24 rounded-2xl bg-brand-50"/><div className="h-4 w-1/2 rounded bg-gray-100"/></div>;
  const errorBanner = error && <div role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button onClick={() => setRetry(n => n + 1)} className="mt-2 inline-flex items-center gap-2 font-bold"><RefreshCw size={16}/>Try again</button></div>;
  if (mode !== 'directory') {
    if (error) return <div className="mx-6 my-3">{errorBanner}</div>;
    if (!mine || mine.assignment_status !== 'assigned') return <section className="mx-6 mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="font-bold">Your FPO group is not available yet</h2><p className="mt-2 text-sm">{mine?.assignment_status==='inactive_fpo' ? 'Your saved FPO membership is not currently eligible for group access. Ask your admin to check the FPO status and your district assignment.' : mine?.assignment_status==='pending_fpo' ? 'Your district is saved, but an FPO group has not been assigned yet.' : 'No active FPO assignment was returned for your account. Check your saved state and district in your profile.'}</p><div className="mt-3 flex gap-4"><Link href="/user-profile" className="text-sm font-bold text-brand-700">Check my profile</Link><button onClick={()=>setRetry(n=>n+1)} className="text-sm font-bold text-brand-700">Refresh assignment</button></div></section>;
    if(mode === 'group') return <Link href="/fpo-group" className="flex items-center gap-3 border-b border-gray-100 px-6 py-4 hover:bg-gray-50"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700"><Building2 size={26}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-gray-900">{title(mine)}</strong><span className="block truncate text-sm text-gray-500">Farmer group ? Tap to chat</span></span>{unread>0&&<span className="rounded-full bg-brand-600 px-2 py-1 text-xs text-white">{unread}</span>}<ChevronRight size={18} className="text-gray-400"/></Link>;
    return <section className="flex h-full min-h-0 flex-col bg-[#efeae2]">
      <header className="flex shrink-0 items-center gap-3 bg-brand-700 px-4 py-3 text-white"><Link href="/chat" aria-label="Back to Messages"><ArrowLeft size={24}/></Link><span className="rounded-full bg-white/20 p-2"><Building2 size={24}/></span><div className="min-w-0"><h1 className="truncate font-bold">{title(mine)}</h1><p className="text-xs text-white/80">Farmers in your assigned FPO</p></div></header>
      {announcementError&&<p className="px-4 text-xs text-gray-500">{announcementError}</p>}
      <FpoGroupChat key={`${userId}:${mine.digital_fpo_id}`} fpoId={mine.digital_fpo_id} userId={userId} announcements={messages}/>
    </section>;
  }

  if (selected) return <section className="px-6 pb-24">
    <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-600"><ArrowLeft size={18}/>All Digital FPOs</button>
    <article className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-soft">
      <div className="bg-brand-700 p-6 text-white"><Building2 size={32} className="mb-5"/><p className="text-xs font-bold uppercase tracking-widest text-brand-100">CoFarmz Digital FPO</p><h2 ref={profileHeading} tabIndex={-1} className="mt-2 text-2xl font-black outline-none">{title(selected)}</h2><p className="mt-2 flex items-center gap-1 text-sm text-brand-100"><MapPin size={15}/>{selected.district}, {selected.state}</p></div>
      <div className="space-y-5 p-6"><span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold capitalize text-brand-700">{selected.status}</span><div><h3 className="font-bold text-gray-900">About this FPO</h3><p className="mt-2 text-sm leading-relaxed text-gray-500">The CoFarmz Digital FPO for farmers in {selected.taluk?`${selected.taluk}, ${selected.district}`:selected.district}, {selected.state}. Assigned farmers receive their group announcements in Messages.</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Registered name</p><p className="mt-1 break-words text-sm font-medium text-gray-700">{selected.name}</p></div>
        <FpoProfileActions groupMessage={mine?.digital_fpo_id === selected.id && mine.assignment_status === "assigned"} key={selected.id} profile={selected} canMessage={user?.role === 'farmer' && selected.status === 'active'}/>
      </div>
    </article>
  </section>;

  const states = Array.from(new Set(fpos.map(f => f.state))).sort();
  const visible = fpos.filter(f => (!state || f.state === state) && `${f.name} ${f.taluk || ""} ${f.district} ${f.state}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => Number(b.id === mine?.digital_fpo_id) - Number(a.id === mine?.digital_fpo_id) || a.district.localeCompare(b.district));
  return <section className="space-y-5 px-6 pb-24">
    {errorBanner}
    <div className="rounded-2xl bg-brand-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-brand-700">District and mandal/taluk communities</p><h2 className="mt-1 text-xl font-black text-gray-900">Find your Digital FPO</h2><p className="mt-2 text-sm leading-relaxed text-gray-500">Explore CoFarmz FPOs across districts and mandals/taluks. Your assigned group is available in Messages.</p>{mine?.assignment_status === 'assigned' && <Link href="/fpo-group" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-700">Go to my group<ArrowUpRight size={16}/></Link>}</div>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-3.5 text-gray-400"/><input aria-label="Search Digital FPOs" placeholder="Search FPO, district or mandal/taluk" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"/>{query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-3 text-gray-400"><X size={18}/></button>}</div><select aria-label="Filter FPOs by state" value={state} onChange={e => setState(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm sm:max-w-52"><option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select></div>
    <p aria-live="polite" className="text-xs font-medium text-gray-500">{visible.length} Digital FPO{visible.length === 1 ? '' : 's'}</p>
    {!visible.length && <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center"><Building2 className="mx-auto mb-3 text-gray-300" size={32}/><h3 className="font-bold text-gray-800">{query || state ? 'No matching FPOs' : 'Digital FPOs are on their way'}</h3><p className="mt-2 text-sm text-gray-500">{query || state ? 'Try another district or choose a different state.' : 'District profiles will appear here when an admin creates them.'}</p>{(query || state) && <button onClick={() => {setQuery('');setState('');}} className="mt-4 text-sm font-bold text-brand-700">Clear filters</button>}</div>}
    <div className="grid gap-4 sm:grid-cols-2">{visible.map(f => <button key={f.id} disabled={!!profileLoading} onClick={() => openProfile(f)} className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-soft transition hover:border-brand-200 focus-visible:outline-brand-600 disabled:opacity-60"><div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 size={24}/></span>{mine?.digital_fpo_id === f.id && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold text-brand-800">MY FPO</span>}</div><h3 className="font-bold text-gray-900">{title(f)}</h3><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13}/>{f.district}, {f.state}</p><div className="mt-5 flex items-center justify-between border-t border-gray-50 pt-3 text-xs font-bold text-brand-700"><span>{profileLoading === f.id ? 'Opening profile...' : 'View FPO profile'}</span><ChevronRight size={16}/></div></button>)}</div>
  </section>;
}
