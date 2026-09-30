'use client';
import { useEffect, useRef, useState } from 'react';
import { fpoFetch } from '@/lib/fpo-fetch';
type Message={id:string;sender_id:string;sender_name:string;sender_role?:string;body:string;created_at:string};
export default function FpoGroupChat({fpoId,userId,replyTo,onClearReply,adminMode=false,readOnly=false,announcements=[]}:{fpoId:string;userId:string;replyTo?:{title:string;sequence:number}|null;onClearReply?:()=>void;adminMode?:boolean;readOnly?:boolean;announcements?:{id:string;title:string;body:string;created_at:string}[]}){
  const [messages,setMessages]=useState<Message[]>([]);
  const [body,setBody]=useState('');
  const timeline=useRef<HTMLDivElement>(null);
  const composer=useRef<HTMLTextAreaElement>(null);
  const [announcementReply,setAnnouncementReply]=useState<{title:string;sequence:number}|null>(null);
  const activeReply=announcementReply||replyTo;
  const replyPrefix=activeReply ? `Reply to announcement: ${activeReply.title.slice(0,300)}\n\n` : '';
  useEffect(()=>{
    if(activeReply){composer.current?.scrollIntoView({behavior:'smooth',block:'center'});composer.current?.focus({preventScroll:true});}
  },[activeReply]);
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
  useEffect(()=>{const el=timeline.current;if(el&&offset===0)el.scrollTop=el.scrollHeight;},[messages.length,announcements.length,offset]);
  useEffect(()=>{const timer=setInterval(()=>{if(offset===0&&document.visibilityState==='visible')setVersion(v=>v+1);},10000);return ()=>clearInterval(timer);},[offset]);
  return <section className={`flex min-h-0 flex-1 flex-col ${adminMode ? "h-[65dvh]" : ""}`}>
    <div ref={timeline} className="min-h-0 flex-1 overflow-y-auto space-y-3 p-4" role="log" aria-label="Group messages">
    {error&&<p role="alert" className="text-sm text-red-700">{error}<button className="ml-2 underline" onClick={()=>setVersion(v=>v+1)}>Retry</button></p>}
    {busy&&<p role="status" className="text-center text-xs text-gray-500">Updating...</p>}
    {next!==null&&<button disabled={busy} onClick={()=>setOffset(next)} className="mx-auto block rounded-full bg-white px-4 py-2 text-xs text-brand-700">Load older messages</button>}
    {[...messages.map(m=>({...m,kind:'message' as const,title:''})),...announcements.map(a=>({...a,kind:'announcement' as const,sender_id:'',sender_name:'FPO announcement',sender_role:''}))].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()||a.id.localeCompare(b.id)).map(m=><article key={`${m.kind}:${m.id}`} className={`w-fit max-w-[85%] rounded-2xl p-3 shadow-sm ${m.sender_id===userId?'ml-auto rounded-tr-sm bg-[#d9fdd3]':'mr-auto rounded-tl-sm bg-white'}`}><p className="text-xs font-bold text-brand-700">{m.sender_id===userId?'You':m.sender_name}{['admin','superadmin','super_admin'].includes(m.sender_role||'')?' (FPO admin)':''}</p>{m.title&&<h3 className="mt-1 font-bold">{m.title}</h3>}<p className="whitespace-pre-wrap break-words text-sm">{m.body}</p><time className="mt-1 block text-right text-[10px] text-gray-500">{new Date(m.created_at).toLocaleString()}</time>{m.kind==='announcement'&&!readOnly&&<button className="mt-2 text-xs font-bold text-brand-700" onClick={()=>setAnnouncementReply({title:m.title,sequence:Date.now()})}>Reply</button>}</article>)}
    {!busy&&!error&&!messages.length&&!announcements.length&&<p className="text-sm text-gray-500">Start a conversation with your fellow farmers.</p>}
    </div>
    {!readOnly&&<form className="shrink-0 space-y-2 border-t border-gray-200 bg-[#f0f2f5] p-3" onSubmit={async e=>{
      e.preventDefault();if(sending||!body.trim())return;if((replyPrefix+body.trim()).length>5000){setSendError('Please shorten your reply to fit the message limit.');return;}setSending(true);setSendError('');
      try{const r=await fpoFetch('/api/digital-fpos/group-chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fpoId,body:replyPrefix+body.trim()})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to send');setBody('');setAnnouncementReply(null);onClearReply?.();setOffset(0);setVersion(v=>v+1);}
      catch(e){setSendError(e instanceof Error?e.message:'Unable to send');}finally{setSending(false);}
    }}>{activeReply&&<div className="rounded-xl border-l-4 border-brand-600 bg-white p-3"><p className="text-xs font-bold text-brand-700">Replying to announcement</p><p className="break-words text-sm">{activeReply.title}</p><button type="button" disabled={sending} onClick={()=>{setAnnouncementReply(null);onClearReply?.();}} className="mt-1 text-xs font-bold text-gray-500">Send a normal message instead</button><p className="mt-1 text-xs text-gray-500">Your reply will be shared with this FPO farmer group.</p></div>}<label className="block text-sm font-medium"><span className="sr-only">Message</span><textarea ref={composer} placeholder="Message" rows={1} maxLength={5000-replyPrefix.length} required disabled={sending} value={body} onChange={e=>setBody(e.target.value)} className="mt-1 block w-full rounded-xl border p-3"/></label><button disabled={sending||!body.trim()} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{sending?'Sending…':'Send'}</button>{sendError&&<p role="alert" className="text-sm text-red-700">{sendError}</p>}</form>}{readOnly&&<p className="text-sm text-gray-500">Inactive FPO: history is available; sending is disabled.</p>}
  </section>;
}
