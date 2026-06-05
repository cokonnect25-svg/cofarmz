'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Suspense } from 'react';
import { Heart, MessageCircle, Send, ArrowLeft, X } from 'lucide-react';
import { getApiUrl } from '@/lib/api';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

const SCROLL_KEY = 'reels_scrollY';
const INDEX_KEY = 'reels_currentIndex';
const REEL_ID_KEY = 'reels_currentReelId';

interface Reel {
  id: string;
  user_id: string;
  video_url: string;
  caption: string;
  likes: number;
  comments: number;
  views: number;
  is_liked: boolean;
  is_followed: boolean;
  name: string;
  image: string;
  created_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  comment: string;
  created_at: string;
  name: string;
  image: string;
}

function ReelsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedReels, setLikedReels] = useState<Set<string>>(new Set());
  const [currentReelIndex, setCurrentReelIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [currentReelComments, setCurrentReelComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [followingUsers, setFollowingUsers] = useState<Set<string>>(new Set());
  const [followingLoading, setFollowingLoading] = useState<Set<string>>(new Set());
  const [videoErrors, setVideoErrors] = useState<Set<string>>(new Set());
  const [isMuted, setIsMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);
  const videosRef = useRef<(HTMLVideoElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastTapRef = useRef<number>(0);
  const [videoReady, setVideoReady] = useState<Set<string>>(new Set());
  const [shareToast, setShareToast] = useState<string | null>(null);
  const likingRef = useRef(new Set<string>());
  const viewedReelsRef = useRef<Set<string>>(new Set());
  const [showLikers, setShowLikers] = useState(false);
const [likers, setLikers] = useState<Array<{id: string, name: string, image: string, role?: string, location?: string, liked_at?: string}>>([]);
const [likersLoading, setLikersLoading] = useState(false);
  
  // Refs for scroll restoration
  const pendingScrollRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    const fetchReels = async () => {
      try {
        const filterUserId = searchParams.get('userId');
        const apiUrl = filterUserId
          ? getApiUrl(`/api/reels?userId=${filterUserId}&currentUserId=${user.id}&limit=50`)
          : getApiUrl(`/api/reels?currentUserId=${user.id}&limit=20`);

        const res = await fetch(apiUrl);
        if (res.ok) {
          const response = await res.json();
          const data = response.data || response;
          setReels(data);
          const likedSet = new Set<string>();
          const followingSet = new Set<string>();
          data.forEach((reel: Reel) => {
            if (reel.is_liked) likedSet.add(reel.id);
            if (reel.is_followed) followingSet.add(reel.user_id);
          });
          setLikedReels(likedSet);
          setFollowingUsers(followingSet);
          
          // Check for saved scroll position first
          const savedScroll = sessionStorage.getItem(SCROLL_KEY);
          const savedIndex = sessionStorage.getItem(INDEX_KEY);
          const savedReelId = sessionStorage.getItem(REEL_ID_KEY);
          
          // Clear saved state
          sessionStorage.removeItem(SCROLL_KEY);
          sessionStorage.removeItem(INDEX_KEY);
          sessionStorage.removeItem(REEL_ID_KEY);
          
          const targetReelId = searchParams.get('reelId');
          
          if (savedScroll && savedIndex && !targetReelId) {
            // Restoring from profile navigation
            isRestoringRef.current = true;
            const idx = parseInt(savedIndex);
            pendingScrollRef.current = parseInt(savedScroll);
            pendingIndexRef.current = idx;
            setCurrentReelIndex(idx);
          } else if (targetReelId) {
            // Deep link from URL
            const idx = data.findIndex((r: Reel) => r.id === targetReelId);
            if (idx >= 0) {
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTop = idx * scrollContainerRef.current.clientHeight;
                  setCurrentReelIndex(idx);
                }
              }, 100);
            }
          }
        } else {
          const errorData = await res.json();
          console.error('Error fetching reels:', res.status, errorData);
        }
      } catch (error) {
        console.error('Error fetching reels:', error instanceof Error ? error.message : String(error));
      } finally {
        setLoading(false);
      }
    };

    fetchReels();
  }, [user, authLoading, router, searchParams]);


  // Apply scroll restoration after reels load and videos are ready
  useEffect(() => {
    if (reels.length === 0) return;
    if (pendingScrollRef.current === null || pendingIndexRef.current === null) return;

    const targetScroll = pendingScrollRef.current;
    const targetIndex = pendingIndexRef.current;
    
    pendingScrollRef.current = null;
    pendingIndexRef.current = null;

    // Wait for DOM to settle and videos to initialize
    const attempts = [100, 300, 600, 1000];
    attempts.forEach(delay => {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = targetScroll;
          setCurrentReelIndex(targetIndex);
        }
      }, delay);
    });

    // Release restore lock after max delay
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 1200);
  }, [reels, videoReady]);

  const trackView = useCallback(async (reelId: string) => {
  if (viewedReelsRef.current.has(reelId)) return; // Don't count twice
  viewedReelsRef.current.add(reelId);
  
  try {
    await fetch(getApiUrl(`/api/reels/${reelId}/view`), { method: 'POST' });
  } catch (err) {
    console.error('Failed to track view:', err);
  }
}, []);

useEffect(() => {
  videosRef.current.forEach((video, idx) => {
    if (!video) return;
    video.muted = isMuted;
    if (idx === currentReelIndex && videoReady.has(reels[idx]?.id)) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}, [currentReelIndex, videoReady, isMuted]);


const fetchLikers = async (reelId: string) => {
  setLikersLoading(true);
  try {
    const res = await fetch(getApiUrl(`/api/reels/${reelId}/like`));
    if (res.ok) {
      const data = await res.json();
      setLikers(data.likers || []);
    }
  } catch (err) {
    console.error('Error fetching likers:', err);
  } finally {
    setLikersLoading(false);
  }
};

const handleShowLikers = (reelId: string) => {
  setShowLikers(true);
  fetchLikers(reelId);
};

  const handleLike = async (reelId: string) => {
    if (!user) return;

    const wasLiked = likedReels.has(reelId);
    if (likingRef.current.has(reelId)) return;
    likingRef.current.add(reelId);

    setLikedReels((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(reelId) : next.add(reelId);
      return next;
    });
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId
          ? { ...r, likes: Math.max(0, Number(r.likes) + (wasLiked ? -1 : 1)) }
          : r
      )
    );

    try {
      const res = await fetch(getApiUrl(`/api/reels/${reelId}/like`), {
        method: 'POST',
        headers: { 'x-user-id': user.id },
      });
      if (!res.ok) throw new Error('Failed');
      const { liked } = await res.json();
      if (liked === wasLiked) {
        setLikedReels((prev) => {
          const next = new Set(prev);
          wasLiked ? next.add(reelId) : next.delete(reelId);
          return next;
        });
        setReels((prev) =>
          prev.map((r) =>
            r.id === reelId
              ? { ...r, likes: Math.max(0, r.likes + (wasLiked ? 1 : -1)) }
              : r
          )
        );
      }
    } catch {
      setLikedReels((prev) => {
        const next = new Set(prev);
        wasLiked ? next.add(reelId) : next.delete(reelId);
        return next;
      });
      setReels((prev) =>
        prev.map((r) =>
          r.id === reelId
            ? { ...r, likes: Math.max(0, r.likes + (wasLiked ? 1 : -1)) }
            : r
        )
      );
    } finally {
      likingRef.current.delete(reelId);
    }
  };

  const handleFollow = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (!user) return;

    setFollowingLoading((prev) => new Set(prev).add(userId));

    try {
      const isCurrentlyFollowing = followingUsers.has(userId);
      const method = isCurrentlyFollowing ? 'DELETE' : 'POST';

      const res = await fetch(
        getApiUrl(`/api/follows`),
        {
          method,
          headers: {
            'x-user-id': user.id,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ followingId: userId })
        }
      );

      if (res.ok) {
        setFollowingUsers((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(userId)) {
            newSet.delete(userId);
          } else {
            newSet.add(userId);
          }
          return newSet;
        });

        setReels((prev) =>
          prev.map((reel) =>
            reel.user_id === userId
              ? { ...reel, is_followed: !isCurrentlyFollowing }
              : reel
          )
        );
      }
    } catch (error) {
      console.error('Error toggling follow:', error instanceof Error ? error.message : String(error));
    } finally {
      setFollowingLoading((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const fetchComments = async (reelId: string) => {
    setCommentsLoading(true);
    try {
      const res = await fetch(getApiUrl(`/api/reels/${reelId}/comments`));
      if (res.ok) {
        const data = await res.json();
        setCurrentReelComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error instanceof Error ? error.message : String(error));
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleOpenComments = (reelId: string) => {
    setShowComments(true);
    fetchComments(reelId);
  };

  const handlePostComment = async () => {
    if (!user || !newComment.trim() || postingComment) return;

    setPostingComment(true);
    try {
      const res = await fetch(
        getApiUrl(`/api/reels/${reels[currentReelIndex].id}/comments`),
        {
          method: 'POST',
          headers: {
            'x-user-id': user.id,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ comment: newComment })
        }
      );

      if (res.ok) {
        const newCommentData = await res.json();
        setCurrentReelComments([
          { ...newCommentData, name: user.name, image: user.image },
          ...currentReelComments
        ]);
        setNewComment('');
        setReels((prev) =>
          prev.map((reel) =>
            reel.id === reels[currentReelIndex].id
              ? { ...reel, comments: (reel.comments || 0) + 1 }
              : reel
          )
        );
      }
    } catch (error) {
      console.error('Error posting comment:', error instanceof Error ? error.message : String(error));
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = async (e: React.MouseEvent, reel: Reel) => {
    e.stopPropagation();

    const shareUrl = `https://cofarmz.com/reels?reelId=${reel.id}`;
    const title = reel.name ? `${reel.name} on CoFarmz` : 'CoFarmz Reel';
    const text = reel.caption || 'Check out this reel on CoFarmz!';

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({ title, text, url: shareUrl });
      } catch (err: any) {
        setShareToast(`Error: ${err?.message || 'Share failed'}`);
        setTimeout(() => setShareToast(null), 4000);
      }
      return;
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: shareUrl });
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareToast('🔗 Link copied!');
    } catch {
      setShareToast('Sharing not supported');
    }

    setTimeout(() => setShareToast(null), 2000);
  };

  // ✅ SAVE scroll position before navigating to profile
  const saveStateAndNavigateToProfile = (userId: string) => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_KEY, scrollContainerRef.current.scrollTop.toString());
      sessionStorage.setItem(INDEX_KEY, currentReelIndex.toString());
      sessionStorage.setItem(REEL_ID_KEY, reels[currentReelIndex]?.id || '');
    }
    router.push(`/farmer-profile?id=${userId}`);
  };

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollPosition = container.scrollTop;
    const windowHeight = container.clientHeight;

    const newIndex = Math.round(scrollPosition / windowHeight);
    if (newIndex !== currentReelIndex && newIndex < reels.length) {
      setCurrentReelIndex(newIndex);
    }
  }, [currentReelIndex, reels.length]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 55 }}>
      {/* Header */}
      <div className="h-12 bg-black border-b border-gray-700 px-4 flex items-center gap-3 z-40">
        <button onClick={() => router.back()} className="text-white hover:text-gray-300">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-white">Farm Tales</h1>
      </div>

      {/* Reels Container */}
      {reels.length === 0 ? (
        <div className="flex-1 flex items-center justify-center flex-col gap-4">
          <p className="text-gray-400 text-center text-lg font-semibold">No reels yet</p>
          <p className="text-gray-500 text-center text-sm px-6">Follow farmers to see their reels or check back later</p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
          style={{ scrollSnapType: 'y mandatory' }}
        >
          {reels.map((reel, idx) => (
            <div
              key={reel.id}
              className="w-full h-full snap-start relative flex-shrink-0 bg-black flex items-center justify-center overflow-hidden"
            >
              {/* Video */}
              {videoErrors.has(reel.id) ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <i className="ph ph-video-slash text-4xl text-white/50"></i>
                  </div>
                  <p className="text-white/60 text-sm font-medium">Video unavailable</p>
                  <p className="text-white/30 text-xs mt-1">This video could not be loaded</p>
                </div>
              ) : (
                <div className="relative w-full h-full max-w-sm md:max-w-md lg:max-w-lg mx-auto overflow-hidden shadow-2xl shadow-green-500/10">
                  <video
                    ref={(el) => {
                      videosRef.current[idx] = el;
                      if (el) el.muted = isMuted;
                    }}
                    src={reel.video_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    playsInline
                    loop
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      if (video.duration > 0.1) {
                        video.currentTime = 0.05;
                      }
                    }}
                      onSeeked={(e) => {
                        const video = e.currentTarget;
                        video.pause();
                        setVideoReady((prev) => new Set(prev).add(reel.id));
                        if (idx === currentReelIndex) {
                          video.play().catch(() => {});
                        }
                      }}
                      onPlay={() => {
                        trackView(reel.id);
                      }}
                    onError={() => {
                      setVideoErrors((prev) => new Set(prev).add(reel.id));
                    }}
                    onClick={(e) => {
                      const now = Date.now();
                      const timeSinceLast = now - lastTapRef.current;
                      if (timeSinceLast < 300 && timeSinceLast > 0) {
                        handleLike(reel.id);
                        setShowHeart(true);
                        setTimeout(() => setShowHeart(false), 800);
                      } else {
                        setIsMuted((prev) => !prev);
                      }
                      lastTapRef.current = now;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none"></div>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none"></div>

              {showHeart && idx === currentReelIndex && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                  <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl animate-ping" />
                </div>
              )}

              <div className="absolute left-0 right-16 pr-20 md:px-0 md:pr-0 w-full max-w-sm md:max-w-md lg:max-w-lg mx-auto text-white pointer-events-none z-30" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}>
                <div className="pointer-events-auto flex flex-col gap-4">
                  {/* ✅ SAVE state and navigate to profile */}
                  <div
                    className="flex items-center gap-3 w-fit bg-black/30 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 cursor-pointer active:scale-95 transition-all group"
                    onClick={() => saveStateAndNavigateToProfile(reel.user_id)}
                  >
                    <div className="relative">
                      <img
                        src={reel.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(reel.name || 'F')}&backgroundColor=166534&textColor=ffffff`}
                        alt={reel.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-emerald-500/50 shadow-lg group-hover:border-white transition-colors"
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-500 border-2 border-black rounded-full"></div>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <p className="font-black text-[16px] tracking-tight drop-shadow-md">
                          {reel.name || 'CoFarmz User'}
                        </p>
                        <i className="ph-fill ph-check-circle text-blue-400 text-sm"></i>
                      </div>
                      <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.15em] flex items-center gap-1">
                        Visit Profile <i className="ph-bold ph-caret-right text-[8px] transition-transform group-hover:translate-x-0.5"></i>
                      </p>
                    </div>
                  </div>

                  {reel.caption && (
                    <div className="max-w-[85%]">
                      <p className="text-[15px] font-bold leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,1)] text-white/95">
                        {reel.caption}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={(e) => { e.stopPropagation(); setIsMuted((prev) => !prev); }}
                className="absolute top-4 right-4 z-40 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 active:scale-90 transition-transform"
              >
                {isMuted
                  ? <i className="ph-fill ph-speaker-slash text-white text-xl" />
                  : <i className="ph-fill ph-speaker-high text-white text-xl" />
                }
              </button>

              <div
                className="absolute right-4 md:right-[calc(50%-180px)] lg:right-[calc(50%-230px)] flex flex-col gap-5 text-white z-30"
                style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
              >
                {/* Views */}
                <div className="flex flex-col items-center gap-1 group">
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl transition-all group-hover:scale-110">
                    <i className="ph-fill ph-eye text-[24px] drop-shadow-xl"></i>
                  </div>
                  <span className="text-[11px] font-black drop-shadow-xl tracking-tight uppercase">
                    {reel.views > 999 ? `${(reel.views / 1000).toFixed(1)}k` : reel.views || 0}
                  </span>
                </div>
                
                {/* Mute / Unmute */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMuted((prev) => !prev);
                  }}
                  className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-90"
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
                    {isMuted ? (
                      <i className="ph-fill ph-speaker-slash text-[24px] text-white" />
                    ) : (
                      <i className="ph-fill ph-speaker-high text-[24px] text-white" />
                    )}
                  </div>
                  <span className="text-[11px] font-black drop-shadow-xl tracking-tight uppercase">
                    {isMuted ? 'Mute' : 'Sound'}
                  </span>
                </button>

<div className="flex flex-col items-center gap-1">
  {/* Heart */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      handleLike(reel.id);
    }}
    className="w-12 h-12 rounded-full backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-90 group"
  >
    <Heart
      className={`w-6 h-6 transition-colors duration-300 ${likedReels.has(reel.id) ? 'fill-red-500 text-red-500' : 'text-white'}`}
      strokeWidth={2.5}
    />
  </button>
  
  {/* Count */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      handleShowLikers(reel.id);
    }}
    className="text-[11px] font-black drop-shadow-xl tracking-tight uppercase hover:text-green-400 transition-colors"
  >
    {reel.likes > 999 ? `${(reel.likes / 1000).toFixed(1)}k` : reel.likes} {reel.likes === 1 ? 'like' : 'likes'}
  </button>
</div>

                {/* Comments */}
                <button
                  onClick={() => handleOpenComments(reel.id)}
                  className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-90"
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
                    <MessageCircle className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black drop-shadow-xl tracking-tight uppercase">
                    {reel.comments}
                  </span>
                </button>

                {/* Share */}
                <button
                  onClick={(e) => handleShare(e, reel)}
                  className="flex flex-col items-center gap-1 group transition-transform hover:scale-110 active:scale-90"
                >
                  <div className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl">
                    <Send className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </div>
                  <span className="text-[11px] font-black drop-shadow-xl tracking-tight uppercase">Share</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {shareToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[998] bg-white/90 backdrop-blur text-gray-900 text-sm font-semibold px-5 py-2.5 rounded-full shadow-xl animate-fade-in">
          {shareToast}
        </div>
      )}

      {/* Comments Modal */}
      {showComments && (
        <div
          className="fixed inset-0 z-[999] flex flex-col"
          style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
        >
          <div
            className="flex-1 bg-black/50"
            onClick={() => setShowComments(false)}
          />
          <div
            className="bg-white rounded-t-3xl flex flex-col overflow-hidden"
            style={{ maxHeight: '70vh' }}
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                Comments ({currentReelComments.length})
              </h2>
              <button
                onClick={() => setShowComments(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
              {commentsLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
                </div>
              ) : currentReelComments.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">
                  No comments yet. Be the first!
                </p>
              ) : (
                currentReelComments.map((comment) => (
                  <div key={comment.id} className="flex gap-3">
                    <button
                      onClick={() => saveStateAndNavigateToProfile(comment.user_id)}
                      className="flex-shrink-0"
                    >
                      <img
                        src={comment.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(comment.name || 'U')}&backgroundColor=166534&textColor=ffffff`}
                        alt={comment.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => saveStateAndNavigateToProfile(comment.user_id)}
                        className="font-bold text-sm text-gray-900 hover:text-green-700 transition-colors"
                      >
                        {comment.name}
                      </button>
                      <p className="text-sm text-gray-700 break-words">{comment.comment}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(comment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {user && (
              <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex gap-2 items-center">
                <img
                  src={user.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'U')}&backgroundColor=166534&textColor=ffffff`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  onFocus={() => {
                    setTimeout(() => {
                      document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }, 300);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !postingComment) handlePostComment();
                  }}
                />
                <button
                  onClick={handlePostComment}
                  disabled={!newComment.trim() || postingComment}
                  className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform flex-shrink-0"
                >
                  {postingComment ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Liked By Modal */}
{showLikers && (
  <div
    className="fixed inset-0 z-[999] flex flex-col"
    style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}
  >
    <div
      className="flex-1 bg-black/50"
      onClick={() => setShowLikers(false)}
    />
    <div
      className="bg-white rounded-t-3xl flex flex-col overflow-hidden"
      style={{ maxHeight: '70vh' }}
    >
      <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1 flex-shrink-0" />
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900">
          Liked by
        </h2>
        <button
          onClick={() => setShowLikers(false)}
          className="p-1 hover:bg-gray-100 rounded-full transition"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {likersLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
          </div>
        ) : likers.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            No likes yet. Be the first!
          </p>
        ) : (
          likers.map((liker) => (
            <div key={liker.id} className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowLikers(false);
                  saveStateAndNavigateToProfile(liker.id);
                }}
                className="flex-shrink-0"
              >
                <img
                  src={liker.image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(liker.name || 'U')}&backgroundColor=166534&textColor=ffffff`}
                  alt={liker.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
              </button>
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => {
                    setShowLikers(false);
                    saveStateAndNavigateToProfile(liker.id);
                  }}
                  className="font-bold text-sm text-gray-900 hover:text-green-700 transition-colors block"
                >
                  {liker.name}
                </button>
                {liker.role && (
                  <p className="text-xs text-gray-500">{liker.role}</p>
                )}
                {liker.location && (
                  <p className="text-xs text-gray-400">{liker.location}</p>
                )}
              </div>
              {liker.id !== user?.id && (
                <button
                  onClick={() => {
                    setShowLikers(false);
                    router.push(`/farmer-profile?id=${liker.id}`);
                  }}
                  className="px-4 py-1.5 rounded-full bg-green-600 text-white text-xs font-bold hover:bg-green-700 transition"
                >
                  View
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
    </div>
  );
}

export default function ReelsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[100dvh] bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>
      }
    >
      <ReelsContent />
    </Suspense>
  );
}