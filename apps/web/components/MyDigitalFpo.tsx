'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
export default function MyDigitalFpo() {
  const [mine,setMine]=useState<any>(null);
  const [error,setError]=useState('');
  useEffect(()=>{fetch(getApiUrl('/api/digital-fpos'),{credentials:'include',cache:'no-store'}).then(async r=>{if(!r.ok)throw new Error();setMine((await r.json()).mine);}).catch(()=>setError('Unable to load your assignment'));},[]);
  return <section className="m-4 p-4 rounded-2xl border border-green-200 bg-green-50"><h2 className="font-bold text-green-900">My Digital FPO</h2>
    <p className="break-words">{error || mine?.name || 'Not Assigned'}</p>
    {mine && <p className="text-sm">{mine.district}, {mine.state} · {mine.assignment_status.replaceAll('_',' ')}</p>}
    {!error && !mine?.name && <p className="text-sm">{mine?.assignment_status==='pending_fpo'?'Awaiting Digital FPO creation':mine?.assignment_status==='inactive_fpo'?'Digital FPO inactive':'Location Required'}</p>}
    <Link href="/digital-fpos" className="text-green-800 underline">View group updates, update district, and discover FPOs</Link>
  </section>;
}
