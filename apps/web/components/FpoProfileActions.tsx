'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Phone, MapPin, MessageCircle } from 'lucide-react';
import { fpoMapUrl, type FpoContact } from '@/lib/fpo-profile';
import FpoContactAdmin from '@/components/FpoContactAdmin';
export default function FpoProfileActions({ profile, canMessage, groupMessage = false }: { profile: FpoContact & { id: string }; canMessage: boolean; groupMessage?: boolean }) {
  const [open, setOpen] = useState(false);
  const map = fpoMapUrl(profile);
  const phone = profile.contact_phone?.replace(/[^+0-9]/g, '');
  const style = 'flex flex-col items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3 py-4 text-sm font-bold text-brand-700 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-400';
  return <section className="space-y-3">
    <div className="grid grid-cols-3 gap-3">
      {phone ? <a href={`tel:${phone}`} className={style}><Phone size={20}/>Call</a> : <button disabled title="Phone number not added" className={style}><Phone size={20}/>Call</button>}
      <>{groupMessage && canMessage ? <Link href="/fpo-group" className={style}><MessageCircle size={20}/>Open group</Link> : <button disabled={!canMessage} aria-expanded={open} onClick={() => setOpen(!open)} className={style}><MessageCircle size={20}/>Message</button>}</>
      {map ? <a href={map} target="_blank" rel="noopener noreferrer" className={style}><MapPin size={20}/>Map</a> : <button disabled title="Office location not added" className={style}><MapPin size={20}/>Map</button>}
    </div>
    {(!phone || !map) && <p className="text-xs text-gray-500">{!phone && 'Phone number not added. '}{!map && 'Office location not added.'}</p>}
    {profile.office_address && <p className="text-sm text-gray-600">{profile.office_address}</p>}
    {open && canMessage && !groupMessage && <FpoContactAdmin fpoId={profile.id}/>}
  </section>;
}
