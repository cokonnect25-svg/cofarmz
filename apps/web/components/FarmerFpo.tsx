'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Building2, CheckCheck, ChevronRight, MapPin, MessageCircle, RefreshCw, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

type Profile = { id: string; name: string; state: string; district: string; status: string };
type Assignment = { name: string; digital_fpo_id: string; assignment_status: string; district: string; state: string };
type Update = { id: string; title: string; body: string; created_at: string };
async function request(path: string, read = false, signal?: AbortSignal) {
  const response = await fetch(getApiUrl(path), { credentials: 'include', cache: 'no-store', signal,
    ...(read ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to load Digital FPOs');
  return data;
}
const title = (fpo: { district?: string; name?: string }) => fpo.district ? `${fpo.district} Digital FPO` : fpo.name || 'My Digital FPO';

export default function FarmerFpo({ mode }: { mode: 'directory' | 'group' }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [fpos, setFpos] = useState<Profile[]>([]);
  const [mine, setMine] = useState<Assignment | null>(null);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Update[]>([]);
  const [unread, setUnread] = useState(0);
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
        const feed = mode === 'group' && data.mine?.assignment_status === 'assigned'
          ? await request('/api/digital-fpos/messages', false, controller.signal) : { messages: [], unread: 0 };
        if (!controller.signal.aborted) {
          setFpos(data.fpos); setMine(data.mine); setMessages(feed.messages); setUnread(feed.unread); setError('');
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Unable to load Digital FPOs');
          setMessages([]); setMine(null); setFpos([]); setSelected(null);
        }
      } finally { fetching = false; if (!controller.signal.aborted) setLoading(false); }
    }
    load();
    const timer = mode === 'group' ? setInterval(load, 30000) : null;
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
  if (mode === 'group') {
    if (error) return <div className="mx-6 my-3">{errorBanner}</div>;
    if (!mine || mine.assignment_status !== 'assigned') return null;
    return <section className="mx-6 mb-4 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft">
      <button onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="fpo-group-feed" className="flex w-full items-center gap-3 p-4 text-left hover:bg-brand-50 transition">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700"><Building2 size={24}/></span>
        <span className="min-w-0 flex-1"><span className="text-[10px] font-bold uppercase tracking-widest text-brand-700">My Digital FPO</span><span className="block truncate font-bold text-gray-900">{title(mine)}</span><span className="block truncate text-xs text-gray-500">{messages[0]?.title || 'District news and group updates'}</span></span>
        {unread > 0 && <span aria-label={`${unread} unread updates`} className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{unread}</span>}
        <ChevronRight size={18} className={`shrink-0 text-gray-400 transition ${open ? 'rotate-90' : ''}`}/>
      </button>
      {open && <div id="fpo-group-feed" className="border-t border-brand-100 bg-brand-50/50 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-gray-500">Announcements from your FPO</p>{unread > 0 && <button disabled={marking} onClick={async () => { setMarking(true); try { await request('/api/digital-fpos/messages', true); setUnread(0); } catch(e) { setError(e instanceof Error ? e.message : 'Unable to mark as read'); } finally { setMarking(false); } }} className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 disabled:opacity-50"><CheckCheck size={15}/>{marking ? 'Updating...' : 'Mark all read'}</button>}</div>
        {!messages.length && <div className="py-6 text-center"><MessageCircle className="mx-auto mb-2 text-brand-500"/><p className="font-bold text-gray-800">Your group is ready</p><p className="mt-1 text-sm text-gray-500">New FPO announcements will appear here.</p></div>}
        <div className="max-h-[55dvh] space-y-3 overflow-y-auto">{messages.map(m => <article key={m.id} className="rounded-2xl rounded-tl-sm border border-gray-100 bg-white p-4"><h3 className="font-bold text-gray-900">{m.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-600">{m.body}</p><time dateTime={m.created_at} className="mt-3 block text-[11px] text-gray-400">{new Date(m.created_at).toLocaleString()}</time></article>)}</div>
      </div>}
    </section>;
  }

  if (selected) return <section className="px-6 pb-24">
    <button onClick={() => setSelected(null)} className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-gray-600"><ArrowLeft size={18}/>All Digital FPOs</button>
    <article className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-soft">
      <div className="bg-brand-700 p-6 text-white"><Building2 size={32} className="mb-5"/><p className="text-xs font-bold uppercase tracking-widest text-brand-100">CoFarmz Digital FPO</p><h2 ref={profileHeading} tabIndex={-1} className="mt-2 text-2xl font-black outline-none">{title(selected)}</h2><p className="mt-2 flex items-center gap-1 text-sm text-brand-100"><MapPin size={15}/>{selected.district}, {selected.state}</p></div>
      <div className="space-y-5 p-6"><span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-bold capitalize text-brand-700">{selected.status}</span><div><h3 className="font-bold text-gray-900">About this FPO</h3><p className="mt-2 text-sm leading-relaxed text-gray-500">The CoFarmz Digital FPO for farmers in {selected.district}, {selected.state}. Assigned farmers receive district group announcements in Messages.</p></div><div className="rounded-xl bg-gray-50 p-3"><p className="text-xs text-gray-500">Registered name</p><p className="mt-1 break-words text-sm font-medium text-gray-700">{selected.name}</p></div>
        {mine?.digital_fpo_id === selected.id && mine.assignment_status === 'assigned' && <Link href="/chat" className="flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white"><MessageCircle size={18}/>Open my group</Link>}
      </div>
    </article>
  </section>;

  const states = Array.from(new Set(fpos.map(f => f.state))).sort();
  const visible = fpos.filter(f => (!state || f.state === state) && `${f.name} ${f.district} ${f.state}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a,b) => Number(b.id === mine?.digital_fpo_id) - Number(a.id === mine?.digital_fpo_id) || a.district.localeCompare(b.district));
  return <section className="space-y-5 px-6 pb-24">
    {errorBanner}
    <div className="rounded-2xl bg-brand-50 p-5"><p className="text-xs font-bold uppercase tracking-widest text-brand-700">District communities</p><h2 className="mt-1 text-xl font-black text-gray-900">Find your Digital FPO</h2><p className="mt-2 text-sm leading-relaxed text-gray-500">Explore CoFarmz FPOs across districts. Your assigned group is available in Messages.</p>{mine?.assignment_status === 'assigned' && <Link href="/chat" className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-brand-700">Go to my group<ArrowUpRight size={16}/></Link>}</div>
    <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search size={18} className="absolute left-3.5 top-3.5 text-gray-400"/><input aria-label="Search Digital FPOs" placeholder="Search FPO or district" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-10 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"/>{query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-3 text-gray-400"><X size={18}/></button>}</div><select aria-label="Filter FPOs by state" value={state} onChange={e => setState(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm sm:max-w-52"><option value="">All states</option>{states.map(s => <option key={s}>{s}</option>)}</select></div>
    <p aria-live="polite" className="text-xs font-medium text-gray-500">{visible.length} Digital FPO{visible.length === 1 ? '' : 's'}</p>
    {!visible.length && <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center"><Building2 className="mx-auto mb-3 text-gray-300" size={32}/><h3 className="font-bold text-gray-800">{query || state ? 'No matching FPOs' : 'Digital FPOs are on their way'}</h3><p className="mt-2 text-sm text-gray-500">{query || state ? 'Try another district or choose a different state.' : 'District profiles will appear here when an admin creates them.'}</p>{(query || state) && <button onClick={() => {setQuery('');setState('');}} className="mt-4 text-sm font-bold text-brand-700">Clear filters</button>}</div>}
    <div className="grid gap-4 sm:grid-cols-2">{visible.map(f => <button key={f.id} disabled={!!profileLoading} onClick={() => openProfile(f)} className="group rounded-2xl border border-gray-100 bg-white p-5 text-left shadow-soft transition hover:border-brand-200 focus-visible:outline-brand-600 disabled:opacity-60"><div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-xl bg-brand-50 p-3 text-brand-700"><Building2 size={24}/></span>{mine?.digital_fpo_id === f.id && <span className="rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-bold text-brand-800">MY FPO</span>}</div><h3 className="font-bold text-gray-900">{title(f)}</h3><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13}/>{f.district}, {f.state}</p><div className="mt-5 flex items-center justify-between border-t border-gray-50 pt-3 text-xs font-bold text-brand-700"><span>{profileLoading === f.id ? 'Opening profile...' : 'View FPO profile'}</span><ChevronRight size={16}/></div></button>)}</div>
  </section>;
}
