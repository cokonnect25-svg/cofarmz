'use client';
import { useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';

export default function FpoContactAdmin({ fpoId }: { fpoId: string }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return <form className="space-y-3 rounded-2xl border border-brand-100 p-4" onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setSent(false);
    try {
      const response = await fpoFetch('/api/digital-fpos/contact', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fpoId, body }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to send message');
      setBody(''); setSent(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send message'); }
    finally { setBusy(false); }
  }}>
    <h3 className="font-bold text-gray-900">Message FPO admin</h3>
    <p className="text-sm text-gray-500">Your message goes privately to the admin team for this FPO. Other farmers cannot see it.</p>
    <label className="block text-sm font-medium">Message<textarea required maxLength={5000} disabled={busy} value={body} onChange={e => { setBody(e.target.value); setSent(false); }} rows={4} className="mt-2 w-full rounded-xl border border-gray-200 p-3" placeholder="Write your question or request..." /></label>
    <button disabled={busy || !body.trim()} className="rounded-xl bg-brand-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Sending...' : 'Send to admin'}</button>
    {sent && <p role="status" className="text-sm text-green-700">Message sent to the FPO admin team.</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </form>;
}
