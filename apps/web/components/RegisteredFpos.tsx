'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, MapPin, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { fpoFetch } from '@/lib/fpo-fetch';

type RegisteredFpo = { id: string; name: string; location?: string };

export default function RegisteredFpos() {
  const { user } = useAuth();
  const userId = user?.id;
  const [fpos, setFpos] = useState<RegisteredFpo[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setFpos([]);
    async function load() {
      try {
        // No distance or crop filters: registered accounts with no GPS must
        // also be discoverable, independently of the Digital FPO directory.
        const params = new URLSearchParams({ type: 'fpo', currentUserId: userId! });
        const response = await fpoFetch(`/api/nearby-farmers?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Unable to load registered FPOs');
        const data = await response.json();
        if (!controller.signal.aborted) setFpos(Array.isArray(data) ? data : data.farmers || []);
      } catch (e) {
        if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Unable to load registered FPOs');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [userId, retry]);

  if (!user?.id) return null;
  const visible = fpos.filter(fpo => `${fpo.name} ${fpo.location || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <section aria-labelledby="registered-fpos-heading" className="space-y-4 px-6 pb-8">
    <div><h2 id="registered-fpos-heading" className="text-xl font-black text-gray-900">Registered FPOs</h2><p className="mt-2 text-sm text-gray-500">Explore FPO organizations registered on CoFarmz.</p></div>
    <div className="relative"><Search size={18} className="absolute left-3.5 top-3.5 text-gray-400"/><input aria-label="Search registered FPOs" placeholder="Search FPO name or location" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-gray-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-brand-600"/></div>
    {loading ? <p role="status" className="text-sm text-gray-500">Loading registered FPOs...</p> : error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700"><p>{error}</p><button onClick={() => setRetry(n => n + 1)} className="mt-2 inline-flex items-center gap-2 font-bold"><RefreshCw size={16}/>Try again</button></div> : <>
      <p aria-live="polite" className="text-xs text-gray-500">{visible.length} registered FPO{visible.length === 1 ? '' : 's'}</p>
      {!visible.length && <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">{query ? 'No matching registered FPOs. Try another name or location.' : 'No other registered FPO accounts are available yet.'}</p>}
      <div className="grid gap-4 sm:grid-cols-2">{visible.map(fpo => <Link key={fpo.id} href={`/farmer-profile?id=${encodeURIComponent(fpo.id)}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-soft transition hover:border-brand-200">
        <Building2 size={24} className="mb-4 text-brand-700"/><h3 className="font-bold text-gray-900">{fpo.name}</h3><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><MapPin size={13}/>{fpo.location || 'Location not provided'}</p><span className="mt-5 flex items-center justify-between border-t border-gray-50 pt-3 text-xs font-bold text-brand-700">View FPO profile<ChevronRight size={16}/></span>
      </Link>)}</div>
    </>}
  </section>;
}
