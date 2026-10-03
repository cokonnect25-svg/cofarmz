'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Newspaper, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import PostCard, { SocialPost } from '@/app/components/PostCard';

export default function AllPostsPage() {
  const router = useRouter();
  const { user, loading, isAuthenticated } = useAuth();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const requestRef = useRef(false);
  const load = useCallback(async (reset = false) => {
    if (!user?.id || requestRef.current) return;
    requestRef.current = true;
    setBusy(true);
    setError('');
    try {
      const offset = reset ? 0 : offsetRef.current;
      const response = await fetch(getApiUrl(`/api/posts?viewerId=${encodeURIComponent(user.id)}&offset=${offset}`));
      if (!response.ok) throw new Error('Could not load posts. Please try again.');
      const data: SocialPost[] = await response.json();
      if (!Array.isArray(data)) throw new Error('Could not load posts. Please try again.');
      setPosts(previous => reset ? data : [...previous, ...data.filter(post => !previous.some(existing => existing.id === post.id))]);
      offsetRef.current = offset + data.length;
      setHasMore(data.length === 50);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load posts. Please try again.');
    } finally {
      requestRef.current = false;
      setBusy(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);
  useEffect(() => { void load(true); }, [load]);

  if (loading || !isAuthenticated) return <div className="grid min-h-screen place-items-center"><Loader2 aria-label="Loading" className="h-8 w-8 animate-spin text-green-600" /></div>;

  return (
    <main className="min-h-screen bg-[#f6f8f4] pb-28">
      <header className="border-b border-green-100 bg-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5">
          <button aria-label="Back to home" onClick={() => router.push('/')} className="rounded-full border border-slate-100 p-2.5 text-slate-700 hover:bg-green-50"><ArrowLeft size={20} /></button>
          <div className="flex-1"><h1 className="text-xl font-extrabold text-slate-900">All Posts</h1><p className="mt-1 text-xs text-slate-500">The latest from your CoFarmz community</p></div>
          <button onClick={() => router.push('/posts')} className="flex items-center gap-1 rounded-full bg-green-600 px-3 py-2 text-xs font-bold text-white hover:bg-green-700"><Plus size={16} />New post</button>
        </div>
      </header>
      <section aria-label="Community posts" className="mx-auto max-w-2xl space-y-5 px-4 py-6">
        {posts.map(post => <PostCard key={post.id} post={post} currentUserId={user?.id} />)}
        {error && <div role="alert" className="rounded-2xl border border-red-100 bg-white p-5 text-center"><p className="text-sm text-red-600">{error}</p><button onClick={() => void load(posts.length === 0)} className="mt-3 text-sm font-bold text-green-700">Try again</button></div>}
        {busy && <div role="status" className="flex justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-green-600" />Loading posts...</div>}
        {!busy && !error && posts.length === 0 && <div className="rounded-3xl border border-dashed border-green-200 bg-white px-5 py-12 text-center"><Newspaper className="mx-auto mb-3 text-green-600" size={32} /><h2 className="font-bold text-slate-900">No community posts yet</h2><p className="mt-2 text-sm text-slate-500">Share the first update with your community.</p></div>}
        {!busy && !error && hasMore && <button onClick={() => void load()} className="w-full rounded-2xl border border-green-200 bg-white py-3 text-sm font-bold text-green-700 hover:bg-green-50">Load older posts</button>}
      </section>
    </main>
  );
}
