'use client';
import { useEffect, useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';
type Preferences = {opted_in:boolean;profile_completion:boolean;crop_addition:boolean;nearby_matches:boolean};
export default function WhatsAppPreferences() {
 const [value,setValue]=useState<Preferences|null>(null);
 const [consent,setConsent]=useState(false);
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{let active=true; fpoFetch('/api/whatsapp/preferences').then(async r=>{
  if(!r.ok) throw new Error(); const p=await r.json(); if(active)setValue(p);
 }).catch(()=>{if(active)setMessage('WhatsApp preferences are currently unavailable.');}); return()=>{active=false;};},[]);
 async function save(){if(!value)return;setBusy(true);setMessage('');
  try{const r=await fpoFetch('/api/whatsapp/preferences',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...value,consent})});
   if(!r.ok){const b=await r.json();throw new Error(b.error || 'Unable to save');}setMessage('WhatsApp preferences saved.');setConsent(false);
  }catch(e){setMessage(e instanceof Error?e.message:'Unable to save');}finally{setBusy(false);}}
 return <section className="mx-6 mb-6 rounded-3xl bg-white p-5 shadow-soft">
  <h3 className="font-bold">WhatsApp notifications</h3>
  <p className="my-2 text-sm text-gray-600">Receive CoFarmz reminders and match updates on your registered mobile number. You can turn these off here or reply STOP on WhatsApp.</p>
  {value && <fieldset disabled={busy} className="space-y-3">
   {([['opted_in','Enable WhatsApp messages'],['profile_completion','Profile completion reminders'],['crop_addition','Add crops reminders'],['nearby_matches','Nearby crop matches']] as const).map(([key,label])=><label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={value[key]} onChange={e=>setValue({...value,[key]:e.target.checked})}/>{label}</label>)}
   {value.opted_in && <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to receive the selected WhatsApp messages from CoFarmz, including promotional reminders.</label>}
   <button type="button" disabled={busy || (value.opted_in && !consent)} onClick={save} className="rounded-xl bg-brand-600 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving?':'Save WhatsApp preferences'}</button>
  </fieldset>}
  <p role="status" className="mt-2 text-sm">{message}</p>
 </section>;
}
