'use client';

import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Camera, ImagePlus, Send, Trash2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import UserAvatar from '@/app/components/UserAvatar';

type Post = { id: number; content: string; image_url: string | null; audience: string; created_at: string; author_name?: string; author_image?: string };

export default function PostsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [audience, setAudience] = useState('everyone');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const response = await fetch(getApiUrl(`/api/posts?userId=${encodeURIComponent(user.id)}&viewerId=${encodeURIComponent(user.id)}`));
    const data = await response.json();
    if (response.ok) setPosts(Array.isArray(data) ? data : []);
  }, [user?.id]);
  useEffect(() => { void load(); }, [load]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return setError('Choose an image smaller than 10MB.');
    setUploading(true); setError('');
    try {
      const body = new FormData(); body.append('file', file);
      const response = await fetch(getApiUrl('/api/upload'), { method: 'POST', body });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || 'Upload failed');
      setImageUrl(data.url);
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setUploading(false); }
  };

  const publish = async () => {
    if (!user?.id || !content.trim() || saving || uploading) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(getApiUrl('/api/posts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, content, image_url: imageUrl || null, audience }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not publish post');
      setContent(''); setImageUrl(''); setAudience('everyone'); await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not publish post'); }
    finally { setSaving(false); }
  };

  const remove = async (id: number) => {
    if (!user?.id || !confirm('Delete this post?')) return;
    const response = await fetch(getApiUrl(`/api/posts?id=${id}&userId=${encodeURIComponent(user.id)}`), { method: 'DELETE' });
    if (response.ok) setPosts(current => current.filter(post => post.id !== id));
  };

  if (authLoading) return <div className="min-h-screen grid place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-4 border-green-600 border-t-transparent" /></div>;
  return <main className="min-h-screen bg-gray-50 pb-12">
    <header className="sticky top-0 z-20 border-b bg-white"><div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3"><button onClick={() => router.back()} className="rounded-full p-2 hover:bg-gray-100"><ArrowLeft className="h-5 w-5" /></button><div><h1 className="font-black text-gray-900">My Posts</h1><p className="text-xs text-gray-500">Share updates with the CoFarmz network</p></div></div></header>
    <section className="mx-auto max-w-3xl space-y-5 p-4">
      {!user?.id ? <div className="rounded-2xl bg-white p-10 text-center"><p className="font-bold">Sign in to create posts.</p></div> : <div className="rounded-3xl border bg-white p-4 shadow-sm">
        <div className="flex gap-3"><UserAvatar image={user.image || ''} name={user.name || 'User'} size={42} /><textarea value={content} onChange={e => setContent(e.target.value)} maxLength={3000} rows={4} placeholder="Share an update, requirement, opportunity or announcement…" className="min-w-0 flex-1 resize-none rounded-xl border border-gray-200 p-3 text-sm outline-none focus:border-green-500" /></div>
        {imageUrl && <div className="relative mt-3 overflow-hidden rounded-2xl"><img src={imageUrl} alt="Post preview" className="max-h-80 w-full object-cover" /><button onClick={() => setImageUrl('')} className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-white"><X className="h-4 w-4" /></button></div>}
        <div className="mt-3 flex flex-wrap items-center gap-2"><button onClick={() => inputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-xs font-bold text-green-700"><Camera className="h-4 w-4" />{uploading ? 'Uploading…' : 'Add image'}</button><input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={upload} className="hidden" />
          <select value={audience} onChange={e => setAudience(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold"><option value="everyone">Visible to everyone</option><option value="farmer">Farmers only</option><option value="buyer">Buyers only</option></select>
          <button onClick={publish} disabled={!content.trim() || saving || uploading} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4" />{saving ? 'Posting…' : 'Post'}</button>
        </div>{error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>}
      <div className="space-y-4">{posts.length === 0 ? <div className="rounded-2xl border border-dashed bg-white py-12 text-center text-sm text-gray-500"><ImagePlus className="mx-auto mb-2 h-8 w-8 text-gray-300" />No posts yet.</div> : posts.map(post => <article key={post.id} className="overflow-hidden rounded-3xl border bg-white shadow-sm"><div className="flex items-center gap-3 p-4"><UserAvatar image={user?.image || ''} name={user?.name || 'User'} size={40} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{user?.name}</p><p className="text-[10px] text-gray-500">{new Date(post.created_at).toLocaleString('en-IN')} · {post.audience === 'everyone' ? 'Everyone' : post.audience === 'farmer' ? 'Farmers' : 'Buyers'}</p></div><button onClick={() => remove(post.id)} className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div><p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-gray-800">{post.content}</p>{post.image_url && <img src={post.image_url} alt="Post" className="max-h-[480px] w-full object-cover" />}</article>)}</div>
    </section>
  </main>;
}
