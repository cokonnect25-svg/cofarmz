'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getApiUrl } from '@/lib/api';
type Message = { id: string; body: string; sender_id: string; sender_name: string; created_at: string };
export default function FpoAdminInbox({ groupId }: { groupId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setError('');
    fetch(getApiUrl(`/api/digital-fpos/contact?group=${encodeURIComponent(groupId)}&offset=${offset}`), { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Unable to load inbox'); return data; })
      .then(data => { if (!controller.signal.aborted) { setMessages(old => offset ? [...old, ...data.messages] : data.messages); setNext(data.next); } })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [groupId, offset, version]);
  return <section className="space-y-3 border-t pt-4">
    <div className="flex items-center justify-between gap-3"><h4 className="font-bold">Private admin inbox</h4><button disabled={busy} onClick={() => { setOffset(0); setVersion(v => v + 1); }} className="text-sm font-bold text-brand-700">Refresh</button></div>
    <p className="text-xs text-gray-500">Farmer enquiries to this FPO. Visible only to admins.</p>
    {busy && <p role="status">Loading messages...</p>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {!busy && !error && !messages.length && <p className="text-sm text-gray-500">No farmer enquiries yet.</p>}
    {messages.map(message => <article key={message.id} className="rounded-xl bg-gray-50 p-4"><Link href={`/farmer-profile?id=${encodeURIComponent(message.sender_id)}`} className="font-bold text-brand-700">{message.sender_name}</Link><p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.body}</p><time className="mt-2 block text-xs text-gray-500">{new Date(message.created_at).toLocaleString()}</time></article>)}
    {next !== null && <button disabled={busy} onClick={() => error ? setVersion(v => v + 1) : setOffset(next)} className="text-sm font-bold text-brand-700">{error ? 'Retry' : 'Load older enquiries'}</button>}
  </section>;
}
