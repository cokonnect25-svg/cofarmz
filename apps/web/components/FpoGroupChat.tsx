'use client';
import { useEffect, useRef, useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';
type Message={id:string;sender_id:string;sender_name:string;sender_role?:string;body:string;created_at:string};
export default function FpoGroupChat({fpoId,userId,replyTo,onClearReply,adminMode=false,readOnly=false}:{fpoId:string;userId:string;replyTo?:{title:string;sequence:number}|null;onClearReply?:()=>void;adminMode?:boolean;readOnly?:boolean}){
  const [messages,setMessages]=useState<Message[]>([]);
  const [body,setBody]=useState('');
  const composer=useRef<HTMLTextAreaElement>(null);
  const replyPrefix=replyTo ? `Reply to announcement: ${replyTo.title.slice(0,300)}\n\n` : '';
  useEffect(()=>{
    if(replyTo){composer.current?.scrollIntoView({behavior:'smooth',block:'center'});composer.current?.focus({preventScroll:true});}
  },[replyTo]);
  const [error,setError]=useState('');
  const [sendError,setSendError]=useState('');
  const [sending,setSending]=useState(false);
  const [busy,setBusy]=useState(false);
  const [offset,setOffset]=useState(0);
  const [next,setNext]=useState<number|null>(null);
  const [version,setVersion]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');
    fpoFetch(`/api/digital-fpos/group-chat?fpoId=${encodeURIComponent(fpoId)}&offset=${offset}`,{signal:controller.signal,cache:'no-store'})
      .then(async r=>{const data=await r.json();if(!r.ok){if(r.status===403)setMessages([]);throw new Error(data.error||'Unable to load group');}return data;})
      .then(data=>{if(!controller.signal.aborted){setMessages(old=>offset?[...old,...data.messages]:data.messages);setNext(data.next);}})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return ()=>controller.abort();
  },[fpoId,offset,version]);
  useEffect(()=>{const timer=setInterval(()=>{if(offset===0&&document.visibilityState==='visible')setVersion(v=>v+1);},10000);return ()=>clearInterval(timer);},[offset]);
  return <section className="mb-6 space-y-3">
    <h3 className="font-bold">Farmer group chat</h3><p className="text-xs text-gray-500">{adminMode?'Review all messages and chat as an admin of this FPO. Use Load older messages to browse the full history.':'Chat with all farmers tagged to your FPO. Send a message anytime, or reply to an announcement.'}</p>
    <button disabled={busy} className="text-sm font-bold text-brand-700" onClick={()=>{setOffset(0);setVersion(v=>v+1);}}>Refresh messages</button>
    {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
    {busy&&<p role="status" className="text-xs text-gray-500">Updating messages…</p>}
    {next!==null&&<button disabled={busy} onClick={()=>setOffset(next)} className="block text-sm text-brand-700">Load older messages</button>}
    <div className="max-h-[50dvh] overflow-y-auto space-y-3">{[...messages].reverse().map(m=><article key={m.id} className={`rounded-xl p-3 ${m.sender_id===userId?'ml-6 bg-brand-100':'mr-6 bg-white'}`}><p className="text-xs font-bold text-brand-700">{m.sender_id===userId?'You':m.sender_name}{['admin','superadmin','super_admin'].includes(m.sender_role||'')?' (FPO admin)':''}</p><p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><time className="text-[11px] text-gray-500">{new Date(m.created_at).toLocaleString()}</time></article>)}</div>
    {!busy&&!error&&!messages.length&&<p className="text-sm text-gray-500">Start a conversation with your fellow farmers.</p>}
    {!readOnly&&<form className="sticky bottom-0 z-10 space-y-2 rounded-2xl border border-brand-100 bg-white p-3 shadow-sm" onSubmit={async e=>{
      e.preventDefault();if(sending||!body.trim())return;if((replyPrefix+body.trim()).length>5000){setSendError('Please shorten your reply to fit the message limit.');return;}setSending(true);setSendError('');
      try{const r=await fpoFetch('/api/digital-fpos/group-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fpoId,body:replyPrefix+body.trim()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to send');setBody('');onClearReply?.();setOffset(0);setVersion(v=>v+1);}
      catch(e){setSendError(e instanceof Error?e.message:'Unable to send');}finally{setSending(false);}
    }}>{replyTo&&<div className="rounded-xl border-l-4 border-brand-600 bg-white p-3"><p className="text-xs font-bold text-brand-700">Replying to announcement</p><p className="break-words text-sm">{replyTo.title}</p><button type="button" disabled={sending} onClick={onClearReply} className="mt-1 text-xs font-bold text-gray-500">Send a normal message instead</button><p className="mt-1 text-xs text-gray-500">Your reply will be shared with this FPO farmer group.</p></div>}<label className="block text-sm font-medium">{replyTo ? 'Your reply' : 'Message your group'}<textarea ref={composer} placeholder={replyTo ? 'Write your reply...' : 'Type a message to your farmer group...'} rows={2} maxLength={5000-replyPrefix.length} required disabled={sending} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full rounded-xl border p-3"/></label><button disabled={sending||!body.trim()} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{sending?'Sending…':'Send to group'}</button>{sendError&&<p role="alert" className="text-sm text-red-700">{sendError}</p>}</form>}{readOnly&&<p className="text-sm text-gray-500">Inactive FPO: history is available; sending is disabled.</p>}
  </section>;
}
