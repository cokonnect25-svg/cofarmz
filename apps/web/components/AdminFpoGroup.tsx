'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FpoGroupChat from '@/components/FpoGroupChat';
import { useAuth } from '@/hooks/useAuth';
import FpoAdminInbox from '@/components/FpoAdminInbox';
import { fpoFetch } from '@/lib/fpo-fetch';
import FpoPdfExport from '@/components/FpoPdfExport';

export default function AdminFpoGroup({groupId}: {groupId:string}) {
  const { user } = useAuth();
  const [group,setGroup]=useState<{digital_fpo_id:string;status:string;name:string}|null>(null);
  const [tab,setTab]=useState<'chat'|'members'|'messages'|'inbox'>('chat');
  const [title,setTitle]=useState('');
  const [body,setBody]=useState('');
  const [publishing,setPublishing]=useState(false);
  const [notice,setNotice]=useState('');
  const [version,setVersion]=useState(0);
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
          fpoFetch(`/api/admin/fpo/messages?group=${groupId}`,{credentials:'include',cache:'no-store',signal:controller.signal}),
          fpoFetch(`/api/admin/fpo?group=${groupId}`,{credentials:'include',cache:'no-store',signal:controller.signal}),
        ]);
        const [chat,people]=await Promise.all(responses.map(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load group');return d;}));
        if(controller.signal.aborted)return;
        setGroup(chat.group);setMessages(chat.messages);setNextMessage(chat.next);setMembers(people.farmers);setNextMember(people.next);
      } catch(e:any) { if(!controller.signal.aborted)setError(e.message); }
      finally { if(!controller.signal.aborted)setBusy(false); }
    }
    load();return ()=>controller.abort();
  },[groupId,version]);
  async function more(kind:'messages'|'members') {
    setBusy(true);setError('');
    try {
      const path=kind==='messages'?`/api/admin/fpo/messages?group=${groupId}&offset=${nextMessage}`:`/api/admin/fpo?group=${groupId}&after=${encodeURIComponent(nextMember||'')}`;
      const r=await fpoFetch(path,{credentials:'include',cache:'no-store'});
      const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load group');
      if(kind==='messages'){setMessages(old=>[...old,...d.messages]);setNextMessage(d.next);}
      else{setMembers(old=>[...old,...d.farmers]);setNextMember(d.next);}
    }catch(e:any){setError(e.message);}finally{setBusy(false);}
  }
  return <div className="mt-4 space-y-4 border-t pt-4">
    <h3 className="font-bold text-brand-900">Group overview</h3>
    <p className="text-sm text-gray-600">Manage group chat, announcements, tagged farmers and private enquiries for this FPO.</p>
    <FpoPdfExport groupId={groupId}/>
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {busy&&<p role="status">Loading group information...</p>}
    <div className="flex flex-wrap gap-2 rounded-xl bg-gray-50 p-1">{(['chat','messages','members','inbox'] as const).map(t=><button key={t} onClick={()=>setTab(t)} aria-pressed={tab===t} className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${tab===t?'bg-white text-brand-700 shadow-sm':'text-gray-500'}`}>{{chat:'Group chat',messages:'Announcements',members:'Tagged farmers',inbox:'Private enquiries'}[t]}</button>)}</div>
    {tab==='chat'&&group&&user?.id&&<FpoGroupChat key={group.digital_fpo_id} fpoId={group.digital_fpo_id} userId={user.id} adminMode readOnly={group.status!=='active'}/>}
    {tab==='members'&&<section><h4 className="sr-only">Tagged farmers</h4>
      {!busy&&!members.length&&<p>No assigned farmers.</p>}
      <ul className="divide-y">{members.map(m=><li key={m.id}>
        <Link
          href={`/farmer-profile?id=${encodeURIComponent(m.id)}`}
          className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700"
          aria-label={`View ${m.name}'s profile`}
        >
          <div className="min-w-0">
            <span className="font-medium text-green-800">{m.name}</span>
            <p className="mt-1 text-xs text-gray-500">{m.district}, {m.state} · {m.assignment_status.replaceAll('_',' ')}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-green-700">View profile <span aria-hidden="true">→</span></span>
        </Link>
      </li>)}</ul>
      {nextMember!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('members')}>Load more members</button>}
    </section>}
    {tab==='messages'&&<section>
      <form className="space-y-3 rounded-xl border p-4" onSubmit={async e=>{
        e.preventDefault();if(publishing)return;setPublishing(true);setError('');setNotice('');
        try{const r=await fpoFetch('/api/admin/announcements',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({groupId,title,body})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to publish');setTitle('');setBody('');setNotice('Announcement published to this FPO.');setVersion(v=>v+1);}
        catch(e){setError(e instanceof Error?e.message:'Unable to publish');}finally{setPublishing(false);}
      }}><h4 className="font-bold">Announce to {group?.name||'this FPO'}</h4><input aria-label="Announcement title" required maxLength={200} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Announcement title" className="w-full rounded-xl border p-3"/><textarea aria-label="Announcement message" required maxLength={10000} value={body} onChange={e=>setBody(e.target.value)} placeholder="Announcement message" className="w-full rounded-xl border p-3"/><button disabled={publishing||group?.status!=='active'} className="rounded-xl bg-brand-700 px-4 py-2 text-white disabled:opacity-50">{publishing?'Publishing...':'Publish to this FPO'}</button>{notice&&<p role="status" className="text-green-700">{notice}</p>}</form>
      <h4 className="sr-only">Group messages</h4>
      {!busy&&!messages.length&&<p>No group messages.</p>}
      {messages.map(m=><article key={m.id} className="border border-gray-100 bg-gray-50/50 rounded-2xl p-4 my-3"><h5 className="font-semibold">{m.title}</h5><p className="whitespace-pre-wrap break-words">{m.body}</p><p className="text-xs text-gray-500">{m.sender_name||'Former admin'} · {new Date(m.created_at).toLocaleString()}</p>{m.scheduled_at&&<p className="text-xs">Scheduled: {new Date(m.scheduled_at).toLocaleString()}</p>}{m.expires_at&&<p className="text-xs">Expires: {new Date(m.expires_at).toLocaleString()}</p>}</article>)}
      {nextMessage!==null&&<button disabled={busy} className="underline text-green-800" onClick={()=>more('messages')}>Load older messages</button>}
    </section>}
    {tab==='inbox'&&<FpoAdminInbox key={groupId} groupId={groupId}/>}
  </div>;
}
