'use client';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';

export default function AdminFpoGroup({groupId}: {groupId:string}) {
  const [messages,setMessages] = useState<any[]>([]);
  const [members,setMembers] = useState<any[]>([]);
  const [nextMessage,setNextMessage] = useState<number|null>(null);
  const [nextMember,setNextMember] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    async function load() {
      try {
        const responses=await Promise.all([
          fetch(getApiUrl(`/api/admin/fpo/messages?group=${groupId}`),{credentials:'include',cache:'no-store',signal:controller.signal}),
          fetch(getApiUrl(`/api/admin/fpo?group=${groupId}`),{credentials:'include',cache:'no-store',signal:controller.signal}),
        ]);
        const [chat,people]=await Promise.all(responses.map(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load group');return d;}));
        setMessages(chat.messages);setNextMessage(chat.next);setMembers(people.farmers);setNextMember(people.next);
      } catch(e:any) { if(!controller.signal.aborted)setError(e.message); }
      finally { if(!controller.signal.aborted)setBusy(false); }
    }
    load();return ()=>controller.abort();
  },[groupId]);
  async function more(kind:'messages'|'members') {
    setBusy(true);setError('');
    try {
      const path=kind==='messages'?`/api/admin/fpo/messages?group=${groupId}&offset=${nextMessage}`:`/api/admin/fpo?group=${groupId}&after=${encodeURIComponent(nextMember||'')}`;
      const r=await fetch(getApiUrl(path),{credentials:'include',cache:'no-store'});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load group');
      if(kind==='messages'){setMessages(old=>[...old,...d.messages]);setNextMessage(d.next);}
      else{setMembers(old=>[...old,...d.farmers]);setNextMember(d.next);}
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="mt-4 space-y-4 border-t pt-4">
    <h3 className="font-bold text-green-900">Admin group overview</h3>
    <p className="text-sm text-gray-600">Read-only access to this group’s members and message history, including scheduled and expired announcements.</p>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {busy&&<p role="status">Loading group information…</p>}
    <section><h4 className="font-semibold">Group members</h4>
      {!busy&&!members.length&&<p>No assigned farmers.</p>}
      <ul className="divide-y">{members.map(m=><li key={m.id} className="py-2"><span className="font-medium">{m.name}</span><p className="text-sm">{m.district}, {m.state} · {m.assignment_status.replaceAll('_',' ')}</p></li>)}</ul>
      {nextMember!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('members')}>Load more members</button>}
    </section>
    <section><h4 className="font-semibold">Group messages</h4>
      {!busy&&!messages.length&&<p>No group messages.</p>}
      {messages.map(m=><article key={m.id} className="border rounded-xl p-3 my-2"><h5 className="font-semibold">{m.title}</h5><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-xs text-gray-500">{m.sender_name||'Former admin'} · {new Date(m.created_at).toLocaleString()}</p>{m.scheduled_at&&<p className="text-xs">Scheduled: {new Date(m.scheduled_at).toLocaleString()}</p>}{m.expires_at&&<p className="text-xs">Expires: {new Date(m.expires_at).toLocaleString()}</p>}</article>)}
      {nextMessage!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('messages')}>Load older messages</button>}
    </section>
  </div>;
}
