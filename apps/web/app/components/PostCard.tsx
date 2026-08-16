'use client';

import { useState } from 'react';
import { Heart, MessageCircle, Send, Share2, X } from 'lucide-react';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';
import UserAvatar from './UserAvatar';
import { getApiUrl } from '@/lib/api';
import { buildOpenUrl } from '@/lib/deep-link';

export type SocialPost = { id: number; user_id: string; content: string; image_url: string | null; audience: string; created_at: string; author_name?: string; author_image?: string | null; author_role?: string; likes?: number; comments?: number; is_liked?: boolean };
type Comment = { id: number; user_id: string; comment: string; created_at: string; name?: string; image?: string | null };

export default function PostCard({ post, currentUserId, own, onDelete, compact = false }: { post: SocialPost; currentUserId?: string; own?: boolean; onDelete?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(!!post.is_liked);
  const [likes, setLikes] = useState(Number(post.likes || 0));
  const [commentsCount, setCommentsCount] = useState(Number(post.comments || 0));
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const open = async () => {
    setExpanded(true);
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/comments`));
    if (response.ok) setComments(await response.json());
  };
  const toggleLike = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!currentUserId) return;
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/like`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId }) });
    if (response.ok) { const data = await response.json(); setLiked(data.liked); setLikes(data.likes); }
  };
  const comment = async () => {
    if (!currentUserId || !draft.trim() || sending) return;
    setSending(true);
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/comments`), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId, comment: draft }) });
    if (response.ok) { const data = await response.json(); setComments(v => [...v, data]); setCommentsCount(v => v + 1); setDraft(''); }
    setSending(false);
  };
  const shareUrl = buildOpenUrl('/posts', { postId: post.id });
  const shareInside = () => { sessionStorage.setItem('cofarmz_message_draft', `See this CoFarmz post from ${post.author_name || 'a member'}:\n${post.content}\n${shareUrl}`); router.push('/messages'); };
  const shareOutside = async () => {
    setShareOpen(false);
    const data = { title: 'CoFarmz post', text: post.content, url: shareUrl };
    try { if (Capacitor.isNativePlatform()) await Share.share(data); else if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(shareUrl); alert('Post link copied'); } } catch {}
  };

  return <>
    <article onClick={open} className={`cursor-pointer overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md ${compact ? 'w-[88%] max-w-md flex-none snap-center sm:w-[420px]' : ''}`}>
      <div className="flex items-center gap-3 p-4"><UserAvatar image={post.author_image || ''} name={post.author_name || 'User'} size={42} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-gray-900">{post.author_name || 'CoFarmz member'}</p><p className="text-[10px] font-semibold capitalize text-gray-500">{post.author_role || 'member'} · {new Date(post.created_at).toLocaleString('en-IN')}</p></div>{own && onDelete && <button onClick={e => { e.stopPropagation(); onDelete(); }} className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50">Delete</button>}</div>
      <p className={`${compact ? 'line-clamp-5' : ''} whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-gray-700`}>{post.content}</p>
      {post.image_url && <img src={post.image_url} alt={`Post by ${post.author_name || 'member'}`} className={`${compact ? 'h-56' : 'max-h-[480px]'} w-full object-cover`} />}
      <div className="grid grid-cols-3 border-t border-gray-100 p-1" onClick={e => e.stopPropagation()}>
        <button onClick={toggleLike} className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold ${liked ? 'text-red-600' : 'text-gray-600 hover:bg-gray-50'}`}><Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />{likes || 'Like'}</button>
        <button onClick={open} className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-gray-600 hover:bg-gray-50"><MessageCircle className="h-5 w-5" />{commentsCount || 'Comment'}</button>
        <button onClick={() => setShareOpen(true)} className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-gray-600 hover:bg-gray-50"><Share2 className="h-5 w-5" />Share</button>
      </div>
    </article>
    {expanded && <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-5" onClick={() => setExpanded(false)}><section onClick={e => e.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4"><h2 className="font-black">Post details</h2><button onClick={() => setExpanded(false)} className="rounded-full bg-gray-100 p-2"><X className="h-5 w-5" /></button></div><div className="p-4"><p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{post.content}</p>{post.image_url && <img src={post.image_url} alt="Post detail" className="mt-4 max-h-[55vh] w-full rounded-2xl object-contain bg-gray-50" />}<h3 className="mb-3 mt-6 font-black">Comments ({commentsCount})</h3><div className="space-y-4">{comments.length ? comments.map(c => <div key={c.id} className="flex gap-3"><UserAvatar image={c.image || ''} name={c.name || 'Member'} size={34} /><div className="rounded-2xl bg-gray-100 px-3 py-2"><p className="text-xs font-black">{c.name || 'Member'}</p><p className="text-sm text-gray-700">{c.comment}</p></div></div>) : <p className="text-sm text-gray-400">No comments yet. Be the first.</p>}</div>{currentUserId && <div className="mt-5 flex gap-2"><input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void comment(); }} maxLength={1000} placeholder="Write a comment…" className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-500" /><button onClick={comment} disabled={!draft.trim() || sending} className="rounded-xl bg-green-600 px-4 text-white disabled:opacity-50"><Send className="h-5 w-5" /></button></div>}</div></section></div>}
    {shareOpen && <div className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-5" onClick={() => setShareOpen(false)}><div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"><h3 className="text-lg font-black">Share post</h3><p className="mt-1 text-sm text-gray-500">Choose where you want to share it.</p><button onClick={shareInside} className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-green-50 p-4 text-left font-bold text-green-800"><Send className="h-5 w-5" />Share inside CoFarmz</button><button onClick={shareOutside} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-gray-100 p-4 text-left font-bold text-gray-800"><Share2 className="h-5 w-5" />Share outside CoFarmz</button></div></div>}
  </>;
}
