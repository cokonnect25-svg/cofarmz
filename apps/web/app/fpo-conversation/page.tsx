'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { fpoFetch } from '@/lib/fpo-fetch';
type Message={id:string;body:string;created_at:string;from_fpo:boolean};
function Conversation() {
  const params=useSearchParams();
  const fpoId=params.get('fpoId')||'';
  const farmerId=params.get('farmerId')||'';
  const {user,loading}=useAuth();
  const reviewer=['admin','superadmin','super_admin'].includes(user?.role);
  const [thread,setThread]=useState<{name:string;status:string;farmer_name:string}|null>(null);
  const [messages,setMessages]=useState<Message[]>([]);
  const [offset,setOffset]=useState(0);
  const [next,setNext]=useState<number|null>(null);
  const [version,setVersion]=useState(0);
  const [body,setBody]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [sending,setSending]=useState(false);
  const [sendError,setSendError]=useState('');
  useEffect(()=>{setThread(null);setMessages([]);setBody('');setOffset(0);},[fpoId,farmerId,user?.id]);
  useEffect(()=>{
    if(!user?.id||!fpoId)return;
    const controller=new AbortController();setBusy(true);setError('');
    fpoFetch(`/api/digital-fpos/conversations?fpoId=${encodeURIComponent(fpoId)}&farmerId=${encodeURIComponent(farmerId)}&offset=${offset}`,{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to load conversation');return data;})
      .then(data=>{if(!controller.signal.aborted){setThread(data.thread);setMessages(old=>offset?[...old,...data.messages]:data.messages);setNext(data.next);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[user?.id,fpoId,farmerId,offset,version]);
  useEffect(()=>{
    const timer=setInterval(()=>{if(document.visibilityState==='visible'&&offset===0)setVersion(v=>v+1);},15000);
    return ()=>clearInterval(timer);
  },[offset]);
  if(loading)return <p className="p-6">Loading…</p>;
  if(!user)return <Link href="/login" className="block p-6">Sign in to view your conversation</Link>;
  return <main className="mx-auto max-w-2xl space-y-4 p-5 pb-28">
    <Link href="/chat" className="text-brand-700 font-bold">? Messages</Link>
    <h1 className="text-xl font-bold">{thread?.name||'FPO conversation'}</h1>
    {reviewer&&thread&&<p className="text-sm text-gray-500">Conversation with {thread.farmer_name}</p>}
    <button disabled={busy} onClick={()=>{setOffset(0);setVersion(v=>v+1);}} className="text-sm font-bold text-brand-700">Refresh conversation</button>
    {busy&&<p role="status" className="text-sm text-gray-500">Updating…</p>}
    {error&&<p role="alert" className="text-red-700">{error}</p>}
    {next!==null&&<button disabled={busy} onClick={()=>setOffset(next)} className="block text-sm text-brand-700">Load older messages</button>}
    <div className="space-y-3">{[...messages].reverse().map(m=><article key={m.id} className={`max-w-[90%] rounded-2xl p-4 ${m.from_fpo===reviewer?'ml-auto bg-brand-50':'bg-gray-100'}`}><p className="text-xs font-bold text-brand-700">{m.from_fpo?'FPO admin':reviewer?thread?.farmer_name:'You'}</p><p className="whitespace-pre-wrap break-words mt-1">{m.body}</p><time className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</time></article>)}</div>
    {thread?.status==='active'&&<form className="space-y-2" onSubmit={async e=>{
      e.preventDefault();if(sending||!body.trim())return;setSending(true);setSendError('');
      try{
        const r=await fpoFetch(reviewer?'/api/digital-fpos/conversations':'/api/digital-fpos/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fpoId,farmerId,body})});
        const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to send message');
        setBody('');setOffset(0);setVersion(v=>v+1);
      }catch(e){setSendError(e instanceof Error?e.message:'Unable to send message');}finally{setSending(false);}
    }}><label className="block text-sm font-bold">Message<textarea required maxLength={5000} value={body} disabled={sending} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full rounded-xl border p-3" rows={3}/></label><button disabled={sending||!body.trim()} className="rounded-xl bg-brand-700 px-5 py-3 text-white disabled:opacity-50">{sending?'Sending…':'Send message'}</button>{sendError&&<p role="alert" className="text-red-700">{sendError}</p>}</form>}
    {thread&&thread.status!=='active'&&<p className="text-sm text-gray-500">This FPO is inactive. Your conversation history is still available.</p>}
  </main>;
}
export default function FpoConversationPage(){return <Suspense fallback={<p className="p-6">Loading…</p>}><Conversation/></Suspense>;}
