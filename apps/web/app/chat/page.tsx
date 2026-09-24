'use client';

import FarmerFpo from '@/components/FarmerFpo';
import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';
import { MessageCircle, Search, Trash2, X, Check, CheckCheck } from 'lucide-react';

const SCROLL_KEY = 'chatList_scrollY';
const SEARCH_KEY = 'chatList_searchQuery';
const CACHE_KEY_PREFIX = 'chatList_cachedConversations';
const REQUEST_TIMEOUT_MS = 15000;
const CONVERSATION_PAGE_SIZE = 10;

interface Conversation {
  other_user_id: string;
  name: string;
  image: string | null;
  last_message: string;
  last_message_time: string;
  last_message_sender_id?: string;
  last_message_receiver_id?: string;
  last_message_read_at?: string | null;
  machinery_id: string;
  machinery_name: string;
  machinery_image: string;
  unread_count: number;
  is_online: boolean;
  last_seen: string | null;
}

function ConversationSkeleton() {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="px-6 py-4 flex items-center gap-4 animate-pulse">
          <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between mb-2">
              <div className="h-4 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-100 rounded w-12" />
            </div>
            <div className="h-3 bg-gray-100 rounded w-24 mb-2" />
            <div className="h-3 bg-gray-100 rounded w-44" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ChatSkeletonScreen() {
  return (
    <div className="flex flex-col bg-white overflow-y-auto" style={{ height: 'calc(100dvh - 55px)' }}>
      <header className="w-full px-6 pb-4 pt-4 sticky top-0 bg-white z-40">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-black text-gray-900">Messages</h1>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <div className="w-full bg-gray-100 rounded-full pl-12 pr-4 py-3 h-11" />
        </div>
      </header>
      <ConversationSkeleton />
    </div>
  );
}

// ── Online Status Hook (batch check) ───────────────────────
function useOnlineStatuses(userIds: string[]) {
  const [statuses, setStatuses] = useState<Record<string, { isOnline: boolean; lastSeen: string | null }>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (userIds.length === 0) return;
    let shouldReconnect = true;

    const connect = () => {
      if (!shouldReconnect) return;

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/socket`);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe_batch', userIds }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence_batch') {
              setStatuses(data.statuses);
            } else if (data.type === 'presence') {
              setStatuses(prev => ({
                ...prev,
                [data.userId]: { isOnline: data.isOnline, lastSeen: data.lastSeen }
              }));
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          if (!shouldReconnect) return;
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        wsRef.current = ws;
      } catch (e) {}
    };

    connect();

    // Fallback polling
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/users/online-batch?userIds=${userIds.join(',')}`));
        if (res.ok) {
          const data = await res.json();
          setStatuses(data.statuses || {});
        }
      } catch {}
    }, 15000);

    return () => {
      shouldReconnect = false;
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [userIds.join(',')]);

  return statuses;
}

function ChatContent() {
  const router = useRouter();
  const { user, isAuthenticated, loading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [showRefreshingHint, setShowRefreshingHint] = useState(false);

  // Delete conversation state
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [swipedConvId, setSwipedConvId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);

  // Refs for scroll restoration
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const isRestoringRef = useRef(false);
  const allUsersLoadedRef = useRef(false);
  const conversationsFetchInFlightRef = useRef(false);

  // Get online statuses for all conversation partners
  const userIds = conversations.map(c => c.other_user_id);
  const onlineStatuses = useOnlineStatuses(userIds);

  useEffect(() => {
    allUsersLoadedRef.current = false;
    setAllUsers([]);
  }, [user?.id]);

  useEffect(() => {
    if (!loading && user && isAuthenticated) {
      const cacheKey = `${CACHE_KEY_PREFIX}:${user.id}`;
      const cached = sessionStorage.getItem(cacheKey);
      let hasCachedConversations = false;
      if (cached) {
        try {
          const cachedConversations = JSON.parse(cached);
          if (Array.isArray(cachedConversations) && cachedConversations.length > 0) {
            hasCachedConversations = true;
            setConversations(cachedConversations);
            setLoadingConversations(false);
            setShowRefreshingHint(true);
          }
        } catch {}
      }
      fetchConversations({ showLoader: !hasCachedConversations });
    }
  }, [user?.id, isAuthenticated, loading]);

  useEffect(() => {
    if (!user?.id || conversations.length === 0) return;
    sessionStorage.setItem(
      `${CACHE_KEY_PREFIX}:${user.id}`,
      JSON.stringify(conversations.slice(0, CONVERSATION_PAGE_SIZE))
    );
  }, [user?.id, conversations]);

  useEffect(() => {
    if (!user?.id || allUsersLoadedRef.current) return;
    if (!showNewChat && !searchQuery.trim()) return;
    if (searchQuery.trim() && filteredConversations.length > 0) return;

    allUsersLoadedRef.current = true;
    fetchAllUsers();
  }, [user?.id, showNewChat, searchQuery, filteredConversations.length]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLoadingConversations(false);
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Restore scroll position after conversations load
  useEffect(() => {
    if (loadingConversations) return;
    if (pendingScrollRef.current === null) return;

    const target = pendingScrollRef.current;
    pendingScrollRef.current = null;
    isRestoringRef.current = false;

    [50, 150, 350, 600].forEach(delay => {
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = target;
        }
      }, delay);
    });
  }, [loadingConversations, conversations]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = conversations.filter(conv =>
        conv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.machinery_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredConversations(filtered);
    } else {
      setFilteredConversations(conversations);
    }
  }, [searchQuery, conversations]);

  const fetchAllUsers = async () => {
    setLoadingUsers(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(
        getApiUrl(`/api/nearby-farmers?type=all&latitude=0&longitude=0&currentUserId=${encodeURIComponent(user?.id || '')}`),
        { cache: 'no-store', signal: controller.signal }
      );
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data.filter((u: any) => u.id !== user?.id) : []);
    } catch {
      setAllUsers([]);
    } finally {
      window.clearTimeout(timeout);
      setLoadingUsers(false);
    }
  };

  const fetchConversations = async (options: { restoreState?: boolean; showLoader?: boolean; append?: boolean; offset?: number; limit?: number } = {}) => {
    if (!user?.id) {
      setConversations([]);
      setLoadingConversations(false);
      setLoadingMoreConversations(false);
      setHasMoreConversations(false);
      return;
    }

    if (conversationsFetchInFlightRef.current && !options.append) return;

    const {
      restoreState = true,
      showLoader = true,
      append = false,
      offset = 0,
      limit = CONVERSATION_PAGE_SIZE,
    } = options;
    const hadVisibleConversations = conversations.length > 0;

    try {
      if (!append) conversationsFetchInFlightRef.current = true;
      if (append) setLoadingMoreConversations(true);
      else if (showLoader) setLoadingConversations(true);
      setConversationError('');

      if (restoreState) {
        const savedScroll = sessionStorage.getItem(SCROLL_KEY);
        const savedSearch = sessionStorage.getItem(SEARCH_KEY);

        sessionStorage.removeItem(SCROLL_KEY);
        sessionStorage.removeItem(SEARCH_KEY);

        if (savedSearch) setSearchQuery(savedSearch);
        if (savedScroll) {
          isRestoringRef.current = true;
          pendingScrollRef.current = parseInt(savedScroll);
        }
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let payload: any = null;
      try {
        const response = await fetch(
          getApiUrl(`/api/messages/conversations?userId=${encodeURIComponent(user.id)}&limit=${limit}&offset=${offset}`),
          { cache: 'no-store', signal: controller.signal }
        );
        if (!response.ok) throw new Error(`Conversation fetch failed: ${response.status}`);
        payload = await response.json();
      } finally {
        window.clearTimeout(timeout);
      }

      const data = Array.isArray(payload) ? payload : payload.data;
      const nextConversations = Array.isArray(data) ? data : [];

      setHasMoreConversations(Boolean(payload?.pagination?.hasMore));
      setShowRefreshingHint(false);
      setConversations((prev) => {
        if (!append) return nextConversations;

        const existing = new Set(prev.map((c) => `${c.other_user_id}-${c.machinery_id || 'general'}`));
        const merged = [...prev];
        for (const conv of nextConversations) {
          const key = `${conv.other_user_id}-${conv.machinery_id || 'general'}`;
          if (!existing.has(key)) merged.push(conv);
        }
        return merged;
      });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      if (!options.append && !hadVisibleConversations) setConversationError('Unable to load conversations right now.');
      setHasMoreConversations(false);
      if (!options.append && !hadVisibleConversations) setConversations([]);
    } finally {
      if (!options.append) conversationsFetchInFlightRef.current = false;
      setLoadingMoreConversations(false);
      if (options.append) return;
      if (showLoader) setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    const refresh = () => fetchConversations({ restoreState: false, showLoader: false });
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, isAuthenticated]);

  const handleLoadMore = () => {
    if (loadingMoreConversations || !hasMoreConversations) return;
    fetchConversations({
      restoreState: false,
      showLoader: false,
      append: true,
      offset: conversations.length,
      limit: CONVERSATION_PAGE_SIZE,
    });
  };

  const saveStateAndNavigate = (url: string) => {
    if (scrollContainerRef.current) {
      sessionStorage.setItem(SCROLL_KEY, scrollContainerRef.current.scrollTop.toString());
    }
    sessionStorage.setItem(SEARCH_KEY, searchQuery);
    router.push(url);
  };

  const handleDeleteConversation = async () => {
    if (!deleteTarget || !user?.id) return;
    setDeletingConv(true);
    try {
const res = await fetch(getApiUrl(`/api/messages/conversations`), {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    userId: user.id, 
    otherUserId: deleteTarget.other_user_id 
  }),
});
      if (res.ok) {
        setConversations(prev => prev.filter(c => c.other_user_id !== deleteTarget.other_user_id));
        setFilteredConversations(prev => prev.filter(c => c.other_user_id !== deleteTarget.other_user_id));
        setDeleteTarget(null);
        setSwipedConvId(null);
      } else {
        alert('Failed to delete conversation');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error deleting conversation');
    } finally {
      setDeletingConv(false);
    }
  };

  // Swipe handlers for mobile delete
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent, convId: string) => {
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchStartX.current - touchCurrentX.current;
    if (diff > 50) {
      setSwipedConvId(convId);
    } else if (diff < -30) {
      setSwipedConvId(null);
    }
  };

  const handleTouchEnd = () => {
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  const formatTime = (date: string) => {
    const msgDate = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (msgDate.toDateString() === today.toDateString()) {
      return msgDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (msgDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return msgDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (msg: string, maxLength: number = 40) => {
    return msg.length > maxLength ? msg.substring(0, maxLength) + '...' : msg;
  };

  if (loading) {
    return <ChatSkeletonScreen />;
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full min-h-[100dvh] bg-gray-50 flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-xl font-black text-gray-900 mb-2">Login required</h1>
          <p className="text-sm text-gray-500 mb-5">Please login again to view your messages.</p>
          <button
            onClick={() => router.replace('/login')}
            className="px-5 py-2.5 rounded-full bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        ref={scrollContainerRef}
        className="flex flex-col bg-white overflow-y-auto"
        style={{ height: 'calc(100dvh - 55px)' }}
      >
        {/* Header */}
        <header className="w-full px-6 pb-4 pt-4 sticky top-0 bg-white z-40">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black text-gray-900">Messages</h1>
              {showRefreshingHint && (
                <span className="text-[11px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                  Updating...
                </span>
              )}
            </div>
            {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0) > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0)}
              </span>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-full pl-12 pr-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/30"
            />
          </div>
        </header>

        <FarmerFpo mode="group"/>
        {/* Conversations List */}
        <div className="divide-y divide-gray-100">
          {loadingConversations ? (
            <ConversationSkeleton />
          ) : conversationError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <p className="text-sm text-gray-500 mb-4">{conversationError}</p>
              <button
                onClick={() => fetchConversations({ restoreState: false, showLoader: true })}
                className="px-5 py-2.5 rounded-full bg-green-600 text-white text-sm font-bold hover:bg-green-700 transition"
              >
                Retry
              </button>
            </div>
          ) : searchQuery.trim() && filteredConversations.length === 0 ? (
            <div>
              <p className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Users</p>
              {allUsers.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 text-center">No users found for &quot;{searchQuery}&quot;</p>
                </div>
              ) : (
                allUsers
                  .filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((u: any) => (
                    <button
                      key={u.id}
                      onClick={() => saveStateAndNavigate(`/messages?ownerId=${u.id}&ownerName=${encodeURIComponent(u.name)}`)}
                      className="w-full px-6 py-4 flex items-center gap-4 active:bg-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <div className="relative">
                        <img
                          src={u.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 150 150%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22150%22 height=%22150%22/%3E%3Ccircle cx=%2275%22 cy=%2250%22 r=%2220%22 fill=%22%239ca3af%22/%3E%3Cpath d=%22M 50 85 Q 75 75 100 85 L 100 150 L 50 150 Z%22 fill=%22%239ca3af%22/%3E%3C/svg%3E'}
                          alt={u.name}
                          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                        />
                        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          onlineStatuses[u.id]?.isOnline ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{u.role || 'farmer'}</p>
                      </div>
                    </button>
                  ))
              )}
            </div>
          ) : !searchQuery.trim() && filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Messages Yet</h3>
              <p className="text-sm text-gray-500 text-center">Tap + to start a conversation</p>
            </div>
          ) : (
            <>
            {filteredConversations.map((conversation) => {
              const status = onlineStatuses[conversation.other_user_id];
              const isOnline = status?.isOnline ?? conversation.is_online;
              const hasUnread = (conversation.unread_count || 0) > 0;
              const isLastMessageOwn = conversation.last_message_sender_id === user?.id;
              const lastMessageSeen = Boolean(conversation.last_message_read_at);

              return (
                <div 
                  key={`${conversation.other_user_id}-${conversation.machinery_id || 'general'}`}
                  className="relative overflow-hidden"
                  onTouchStart={handleTouchStart}
                  onTouchMove={(e) => handleTouchMove(e, conversation.other_user_id)}
                  onTouchEnd={handleTouchEnd}
                >
                  {/* Swipe-to-delete background */}
                  {swipedConvId === conversation.other_user_id && (
                    <div className="absolute right-0 top-0 bottom-0 w-24 bg-red-500 flex items-center justify-center z-10">
                      <button 
                        onClick={() => setDeleteTarget(conversation)}
                        className="flex flex-col items-center text-white"
                      >
                        <Trash2 className="w-6 h-6" />
                        <span className="text-xs font-bold mt-1">Delete</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const url = `/messages?ownerId=${conversation.other_user_id}&ownerName=${encodeURIComponent(conversation.name)}${conversation.machinery_id ? `&machineryId=${conversation.machinery_id}` : ''}`;
                      saveStateAndNavigate(url);
                    }}
                    className={`w-full px-6 py-4 flex items-center gap-4 active:bg-gray-50 transition-colors hover:bg-gray-50 ${
                      swipedConvId === conversation.other_user_id ? 'transform -translate-x-24' : ''
                    } transition-transform duration-200`}
                  >
                    {/* User Avatar with Online Indicator */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={conversation.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 150 150%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22150%22 height=%22150%22/%3E%3Ccircle cx=%2275%22 cy=%2250%22 r=%2220%22 fill=%22%239ca3af%22/%3E%3Cpath d=%22M 50 85 Q 75 75 100 85 L 100 150 L 50 150 Z%22 fill=%22%239ca3af%22/%3E%3C/svg%3E'}
                        alt={conversation.name}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                      <div className={`absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                        isOnline ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                    </div>

                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-baseline justify-between mb-1">
                        <h3 className={`truncate ${hasUnread ? 'font-black text-gray-900' : 'font-bold text-gray-900'}`}>
                          {conversation.name}
                        </h3>
                        <span className={`text-xs font-medium ml-2 flex-shrink-0 ${
                          hasUnread ? 'text-green-600 font-bold' : 'text-gray-500'
                        }`}>
                          {formatTime(conversation.last_message_time)}
                        </span>
                      </div>

                      {conversation.machinery_name ? (
                        <p className="text-xs text-gray-500 font-medium mb-1 truncate">
                          {conversation.machinery_name}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 font-medium mb-1 truncate italic">
                          Farmer chat
                        </p>
                      )}

                      <div className="flex items-center gap-1">
                        {conversation.last_message && (
                          <>
                            {isLastMessageOwn && (
                              <span className="flex-shrink-0" title={lastMessageSeen ? 'Seen' : 'Sent'}>
                                {lastMessageSeen ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                ) : (
                                  <Check className="w-3.5 h-3.5 text-gray-400" />
                                )}
                              </span>
                            )}
                            <p className={`text-sm truncate ${
                              hasUnread ? 'text-gray-900 font-semibold' : 'text-gray-600'
                            }`}>
                              {truncateMessage(conversation.last_message)}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side: Unread badge + machinery thumbnail */}
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      {hasUnread && (
                        <span className="bg-green-500 text-white text-xs font-bold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center">
                          {conversation.unread_count}
                        </span>
                      )}

                      {conversation.machinery_image && (
                        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                          <img
                            src={conversation.machinery_image}
                            alt={conversation.machinery_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
            {!searchQuery.trim() && hasMoreConversations && (
              <div className="px-6 py-5">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMoreConversations}
                  className="w-full py-3 rounded-full bg-gray-100 text-gray-800 text-sm font-bold hover:bg-gray-200 transition disabled:opacity-60"
                >
                  {loadingMoreConversations ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
            </>
          )}
        </div>
      </div>

      {/* Delete Conversation Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Conversation?</h3>
            <p className="text-sm text-gray-500 mb-5">
              All messages with <span className="font-bold text-gray-700">{deleteTarget.name}</span> will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => { setDeleteTarget(null); setSwipedConvId(null); }} 
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteConversation} 
                disabled={deletingConv}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingConv ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-[28px] p-6 pb-10 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">New Message</h2>
              <button onClick={() => { setShowNewChat(false); setUserSearchQuery(''); }} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-gray-100 rounded-full pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500/30"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingUsers ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading users...</div>
              ) : (
                allUsers
                  .filter((u: any) => u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map((u: any) => {
                    const status = onlineStatuses[u.id];
                    return (
                      <button
                        key={u.id}
                        onClick={() => {
                          setShowNewChat(false);
                          saveStateAndNavigate(`/messages?ownerId=${u.id}&ownerName=${encodeURIComponent(u.name)}`);
                        }}
                        className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                      >
                        <div className="relative">
                          <img
                            src={u.image || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 150 150%22%3E%3Crect fill=%22%23e5e7eb%22 width=%22150%22 height=%22150%22/%3E%3Ccircle cx=%2275%22 cy=%2250%22 r=%2220%22 fill=%22%239ca3af%22/%3E%3Cpath d=%22M 50 85 Q 75 75 100 85 L 100 150 L 50 150 Z%22 fill=%22%239ca3af%22/%3E%3C/svg%3E'}
                            alt={u.name}
                            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                          />
                          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                            status?.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-gray-900">{u.name}</p>
                          <p className="text-xs text-gray-500 capitalize">{u.role || 'farmer'}</p>
                        </div>
                      </button>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="w-full min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-green-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
