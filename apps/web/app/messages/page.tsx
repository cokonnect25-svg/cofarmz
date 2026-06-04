'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Send, ArrowLeft, Trash2, Check, CheckCheck, MoreVertical } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

const TOP_NAV_H = 64;
const BOTTOM_NAV_H = 60;

// ── Online Status Hook ───────────────────────────────────────
function useOnlineStatus(userId: string | null) {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const connect = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/api/socket`);

        ws.onopen = () => {
          ws.send(JSON.stringify({ type: 'subscribe', userId }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence' && data.userId === userId) {
              setIsOnline(data.isOnline);
              setLastSeen(data.lastSeen);
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          setIsOnline(false);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch (e) {}
    };

    connect();

    // Fallback: poll online status every 10s
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(getApiUrl(`/api/users/online?userId=${userId}`));
        if (res.ok) {
          const data = await res.json();
          setIsOnline(data.isOnline);
          setLastSeen(data.lastSeen);
        }
      } catch {}
    }, 10000);

    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      clearInterval(pollInterval);
    };
  }, [userId]);

  return { isOnline, lastSeen };
}

// ── Format last seen ─────────────────────────────────────────
function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'offline';
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MessagesContent() {
  const searchParams = useSearchParams();
  const ownerId = searchParams.get('ownerId');
  const machineryId = searchParams.get('machineryId');
  const ownerName = searchParams.get('ownerName');

  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [deletingMsg, setDeletingMsg] = useState(false);
  const [showConvDeleteConfirm, setShowConvDeleteConfirm] = useState(false);
  const [deletingConv, setDeletingConv] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Online status
  const { isOnline, lastSeen } = useOnlineStatus(ownerId);

  // Mark messages as read when viewing
  const markAsRead = useCallback(async () => {
    if (!user?.id || !ownerId) return;
    try {
      await fetch(getApiUrl(`/api/messages/read`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, senderId: ownerId }),
      });
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, [user?.id, ownerId]);

  // Auto-scroll on new messages
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!user?.id || !ownerId) return;
    try {
      const response = await fetch(
        getApiUrl(`/api/messages?userId=${user.id}&otherUserId=${ownerId}`)
      );
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
        markAsRead();
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [user?.id, ownerId, markAsRead]);

  useEffect(() => {
    setLoading(true);
    fetchMessages().then(() => setLoading(false));
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Close options menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !ownerId) return;
    try {
      setSending(true);
      const response = await fetch(getApiUrl(`/api/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: ownerId,
          machineryId: machineryId,
          message: newMessage,
        }),
      });
      if (response.ok) {
        const newMsg = await response.json();
        setMessages((prev) => [...prev, newMsg]);
        setNewMessage('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  // ✅ FIXED: Delete a single message with proper error handling
  // ✅ FIXED: Delete message with userId in URL query params
  const handleDeleteMessage = async (msgId: number) => {
    if (!user?.id) return;
    setDeletingMsg(true);
    try {
      console.log('Deleting message:', msgId, 'user:', user.id);

      // ✅ Send userId as query param instead of body
      const res = await fetch(
        getApiUrl(`/api/messages/${msgId}?userId=${user.id}`), 
        {
          method: 'DELETE',
          // No body needed — userId is in URL
        }
      );

      const data = await res.json();
      console.log('Delete response:', res.status, data);

      if (res.ok) {
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setShowDeleteConfirm(null);
        setSelectedMessageId(null);
      } else {
        alert(`Failed to delete: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Network error deleting message');
    } finally {
      setDeletingMsg(false);
    }
  };

  // Delete entire conversation
  const handleDeleteConversation = async () => {
    if (!user?.id || !ownerId) return;
    setDeletingConv(true);
    try {
      const res = await fetch(getApiUrl(`/api/messages/conversation`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otherUserId: ownerId }),
      });
      if (res.ok) {
        setMessages([]);
        setShowConvDeleteConfirm(false);
        setShowOptionsMenu(false);
        window.location.href = '/chat';
      } else {
        const data = await res.json();
        alert(`Failed to delete conversation: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      alert('Error deleting conversation');
    } finally {
      setDeletingConv(false);
    }
  };

  // Long press handler for message selection
  const handleTouchStart = (msgId: number) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setSelectedMessageId(msgId);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <div
      className="fixed left-0 right-0 flex flex-col bg-white"
      style={{
        top: `calc(${TOP_NAV_H}px + env(safe-area-inset-top))`,
        bottom: `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom))`,
      }}
    >
      {/* HEADER */}
{/* HEADER */}
<div className="flex-shrink-0 bg-green-600 text-white px-4 py-3 flex items-center gap-3">
  <Link href={`/chat`}>
    <ArrowLeft className="w-6 h-6 cursor-pointer" />
  </Link>

  {/* Avatar with online indicator */}
  <Link href={`/farmer-profile?id=${ownerId}`} className="relative">
    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
      {ownerName ? ownerName.charAt(0).toUpperCase() : '?'}
    </div>
    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-green-600 ${
      isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'
    }`} />
  </Link>

  <div className="flex-1 min-w-0">
    <Link href={`/farmer-profile?id=${ownerId}`}>
      <h1 className="font-bold text-lg truncate hover:underline cursor-pointer">
        {ownerName || 'Chat'}
      </h1>
    </Link>
    <p className="text-xs text-green-100">
      {isOnline ? (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Online
        </span>
      ) : (
        <span>Last seen {formatLastSeen(lastSeen)}</span>
      )}
    </p>
  </div>

  {/* Options menu */}
  <div className="relative" ref={optionsRef}>
    <button 
      onClick={() => setShowOptionsMenu(!showOptionsMenu)}
      className="p-2 hover:bg-white/10 rounded-full transition"
    >
      <MoreVertical className="w-5 h-5" />
    </button>

    {showOptionsMenu && (
      <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[180px] z-50">
        <button 
          onClick={() => { setShowConvDeleteConfirm(true); setShowOptionsMenu(false); }}
          className="w-full px-4 py-2.5 text-left text-red-600 text-sm font-semibold hover:bg-red-50 transition flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Delete Conversation
        </button>
      </div>
    )}
  </div>
</div>

      {/* SCROLLABLE MESSAGE AREA */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4"
      >
        {loading && (
          <p className="text-gray-500 text-center text-sm">Loading messages...</p>
        )}

        {!loading && messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm text-center">
              No messages yet.<br />Start the conversation!
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          const isSelected = selectedMessageId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              onTouchStart={() => handleTouchStart(msg.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessageId(msg.id); }}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm relative group ${
                  isOwn
                    ? 'bg-green-500 text-white rounded-br-sm'
                    : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}
              >
                {/* Delete button - visible on hover for own messages */}
                {isOwn && (
                  <button
                    onClick={() => setShowDeleteConfirm(msg.id)}
                    className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-md"
                    title="Delete message"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}

                <p>{msg.message}</p>
                <div
                  className={`flex items-center gap-1 mt-1 ${
                    isOwn ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <p className={`text-xs ${isOwn ? 'text-green-100' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {/* Read/Unread status - only for own messages */}
                  {isOwn && (
                    <span className="ml-1">
                      {msg.read_at ? (
                        <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-green-200" />
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* INPUT */}
      <div className="flex-shrink-0 border-t bg-white px-4 py-3 flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
          disabled={sending}
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center disabled:opacity-40"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Delete Message Confirmation Modal */}
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Message?</h3>
            <p className="text-sm text-gray-500 mb-5">This message will be removed for you. Others may still see it.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)} 
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteMessage(showDeleteConfirm)} 
                disabled={deletingMsg}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingMsg ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {showConvDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Conversation?</h3>
            <p className="text-sm text-gray-500 mb-5">All messages with {ownerName} will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConvDeleteConfirm(false)} 
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Keep
              </button>
              <button 
                onClick={handleDeleteConversation} 
                disabled={deletingConv}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50"
              >
                {deletingConv ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}