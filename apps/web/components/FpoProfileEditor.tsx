'use client';
import { useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';
import type { FpoContact } from '@/lib/fpo-profile';
export default function FpoProfileEditor({ profile, onSaved }: { profile: FpoContact & { id: string }; onSaved: (contact: FpoContact) => void }) {
  const [phone, setPhone] = useState(profile.contact_phone || '');
  const [address, setAddress] = useState(profile.office_address || '');
  const [latitude, setLatitude] = useState(profile.latitude == null ? '' : String(profile.latitude));
  const [longitude, setLongitude] = useState(profile.longitude == null ? '' : String(profile.longitude));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const inputStyle = 'mt-1 w-full rounded-lg border border-gray-200 p-2 text-sm';
  return <details className="mt-4 rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer font-bold">Edit FPO contact and location</summary>
    <form className="mt-3 space-y-3" onChange={() => setSaved(false)} onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(''); setSaved(false);
      try {
        const response = await fpoFetch(`/api/digital-fpos/${profile.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contact_phone: phone, office_address: address, latitude: latitude.trim() ? Number(latitude) : null, longitude: longitude.trim() ? Number(longitude) : null }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to save profile');
        onSaved(data); setSaved(true);
      } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save profile'); } finally { setBusy(false); }
    }}>
      <p className="text-xs text-gray-500">These details are visible on the FPO profile. Add an office address or both coordinates to enable Map. Leave fields empty to disable the corresponding action.</p>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-sm">Public phone number<input type="tel" maxLength={30} value={phone} onChange={e => setPhone(e.target.value)} className={inputStyle}/></label>
        <label className="block text-sm">Office address<textarea maxLength={500} value={address} onChange={e => setAddress(e.target.value)} className={inputStyle}/></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm">Latitude<input type="number" step="any" min={-90} max={90} value={latitude} onChange={e => setLatitude(e.target.value)} className={inputStyle}/></label><label className="text-sm">Longitude<input type="number" step="any" min={-180} max={180} value={longitude} onChange={e => setLongitude(e.target.value)} className={inputStyle}/></label></div>
        <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-bold text-white">{busy ? 'Saving...' : 'Save profile details'}</button>
      </fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{saved && <p role="status" className="text-sm text-green-700">Profile details saved.</p>}
    </form>
  </details>;
}
