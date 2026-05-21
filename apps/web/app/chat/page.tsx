'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { getApiUrl } from '@/lib/api';

import { MessageCircle, Search } from 'lucide-react';

interface Conversation {
  other_user_id: string;
  name: string;
  image: string | null;
  last_message: string;
  last_message_time: string;
  machinery_id: string;
  machinery_name: string;
  machinery_image: string;
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

  useEffect(() => {
    if (!loading && user && isAuthenticated) {
      fetchConversations();
      fetchAllUsers();
    }
  }, [user?.id, isAuthenticated, loading]);

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
    try {
      const res = await fetch(getApiUrl(`/api/nearby-farmers?type=all&latitude=0&longitude=0&currentUserId=${user?.id}`));
      const data = await res.json();
      setAllUsers(Array.isArray(data) ? data.filter((u: any) => u.id !== user?.id) : []);
    } catch {
      setAllUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await fetch(
        getApiUrl(`/api/messages/conversations?userId=${user?.id}`)
      );
      if (response.ok) {
        const data = await response.json();
        setConversations(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
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

  if (loading || !isAuthenticated) {
    return (
      <div className="w-full min-h-[100dvh] bg-brand-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-brand-600 border-t-transparent animate-spin"></div>
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
  className="flex flex-col bg-white"
  style={{ height: 'calc(100dvh - 55px)' }}
>
        {/* Header */}
        <header className="w-full px-6 pb-4 pt-4 sticky top-[55px] bg-white z-40">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-black text-gray-900">Messages</h1>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-100 rounded-full pl-12 pr-4 py-3 text-sm font-medium text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            />
          </div>
        </header>

        {/* Conversations List */}
        <div className="divide-y divide-gray-100">
          {loadingConversations ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin"></div>
                <p className="text-gray-500 text-sm">Loading conversations...</p>
              </div>
            </div>
          ) : searchQuery.trim() && filteredConversations.length === 0 ? (
            // Search mode: show matching users from all users
            <div>
              <p className="px-6 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Users</p>
              {allUsers.filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <MessageCircle className="w-8 h-8 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 text-center">No users found for "{searchQuery}"</p>
                </div>
              ) : (
                allUsers
                  .filter(u => u.name?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((u: any) => (
                    <button
                      key={u.id}
                      onClick={() => router.push(`/messages?ownerId=${u.id}&ownerName=${encodeURIComponent(u.name)}`)}
                      className="w-full px-6 py-4 flex items-center gap-4 active:bg-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      <img
                        src={u.image }
                        alt={u.name}
                        className="w-14 h-14 rounded-full object-cover flex-shrink-0"
                      />
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
            filteredConversations.map((conversation) => (
              <button
                key={`${conversation.other_user_id}-${conversation.machinery_id || 'general'}`}
                onClick={() => {
                  const url = `/messages?ownerId=${conversation.other_user_id}&ownerName=${encodeURIComponent(conversation.name)}${conversation.machinery_id ? `&machineryId=${conversation.machinery_id}` : ''}`;
                  router.push(url);
                }}
                className="w-full px-6 py-4 flex items-center gap-4 active:bg-gray-50 transition-colors hover:bg-gray-50"
              >
                {/* User Avatar */}
                <div className="relative flex-shrink-0">
                  <img
                    src={
                      conversation.image ||
                      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150"%3E%3Crect fill="%23e5e7eb" width="150" height="150"/%3E%3Ccircle cx="75" cy="50" r="20" fill="%239ca3af"/%3E%3Cpath d="M 50 85 Q 75 75 100 85 L 100 150 L 50 150 Z" fill="%239ca3af"/%3E%3C/svg%3E'
                    }
                    alt={conversation.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                </div>

                {/* Conversation Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-baseline justify-between mb-1">
                    <h3 className="font-bold text-gray-900 truncate">{conversation.name}</h3>
                    <span className="text-xs text-gray-500 font-medium ml-2 flex-shrink-0">
                      {formatTime(conversation.last_message_time)}
                    </span>
                  </div>

                  {/* Machinery Name or Farmer Chat */}
                  {conversation.machinery_name ? (
                    <p className="text-xs text-gray-500 font-medium mb-1 truncate">
                      {conversation.machinery_name}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium mb-1 truncate italic">
                      Farmer chat
                    </p>
                  )}

                  {/* Last Message Preview */}
                  <p className="text-sm text-gray-600 truncate">
                    {truncateMessage(conversation.last_message)}
                  </p>
                </div>

                {/* Machinery Thumbnail */}
                {conversation.machinery_image && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={conversation.machinery_image}
                      alt={conversation.machinery_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="w-full bg-white rounded-t-[28px] p-6 pb-10 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-gray-900">New Message</h2>
              <button onClick={() => { setShowNewChat(false); setUserSearchQuery(''); }} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <i className="ph-bold ph-x text-lg text-gray-600"></i>
              </button>
            </div>
            <div className="relative mb-4">
              <i className="ph-bold ph-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                placeholder="Search by name..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className="w-full bg-gray-100 rounded-full pl-11 pr-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-500/30"
                autoFocus
              />
            </div>
            <div className="overflow-y-auto flex-1">
              {loadingUsers ? (
                <div className="text-center py-8 text-gray-400 text-sm">Loading users...</div>
              ) : (
                allUsers
                  .filter((u: any) => u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()))
                  .map((u: any) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setShowNewChat(false);
                        router.push(`/messages?ownerId=${u.id}&ownerName=${encodeURIComponent(u.name)}`);
                      }}
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-xl hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      <img
                        src={u.image }
                        alt={u.name}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                      />
                      <div className="text-left">
                        <p className="font-bold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{u.role || 'farmer'}</p>
                      </div>
                    </button>
                  ))
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
    <Suspense>
      <ChatContent />
    </Suspense>
  );
}
