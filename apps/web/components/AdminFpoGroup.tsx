'use client';
import { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api';

export default function AdminFpoGroup({groupId}: {groupId:string}) {
  const [tab,setTab]=useState<'members'|'messages'>('members');
  const [messages,setMessages] = useState<any[]>([]);
  const [members,setMembers] = useState<any[]>([]);
  const [nextMessage,setNextMessage] = useState<number|null>(null);
  const [nextMember,setNextMember] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    setBusy(true);setError('');setMembers([]);setMessages([]);setNextMember(null);setNextMessage(null);
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
    <h3 className="font-bold text-brand-900">Group overview</h3>
    <p className="text-sm text-gray-600">Review tagged farmers and the announcement history for this district.</p>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {busy&&<p role="status">Loading group information...</p>}
    <div className="flex gap-2 rounded-xl bg-gray-50 p-1">{(['members','messages'] as const).map(t=><button key={t} onClick={()=>setTab(t)} aria-pressed={tab===t} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${tab===t?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>{t==='members'?'Tagged farmers':'Announcements'}</button>)}</div>
    {tab==='members'&&<section><h4 className="sr-only">Tagged farmers</h4>
      {!busy&&!members.length&&<p>No assigned farmers.</p>}
      <ul className="divide-y">{members.map(m=><li key={m.id} className="py-3"><span className="font-medium">{m.name}</span><p className="mt-1 text-xs text-gray-500">{m.district}, {m.state} · {m.assignment_status.replaceAll('_',' ')}</p></li>)}</ul>
      {nextMember!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('members')}>Load more members</button>}
    </section>}
    {tab==='messages'&&<section><h4 className="sr-only">Group messages</h4>
      {!busy&&!messages.length&&<p>No group messages.</p>}
      {messages.map(m=><article key={m.id} className="border border-gray-100 bg-gray-50/50 rounded-2xl p-4 my-3"><h5 className="font-semibold">{m.title}</h5><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-xs text-gray-500">{m.sender_name||'Former admin'} · {new Date(m.created_at).toLocaleString()}</p>{m.scheduled_at&&<p className="text-xs">Scheduled: {new Date(m.scheduled_at).toLocaleString()}</p>}{m.expires_at&&<p className="text-xs">Expires: {new Date(m.expires_at).toLocaleString()}</p>}</article>)}
      {nextMessage!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('messages')}>Load older messages</button>}
    </section>}
  </div>;
}
