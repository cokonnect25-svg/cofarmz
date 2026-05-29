'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Send, ArrowLeft } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
  const input = document.querySelector("input");

  const handler = () => {
    setTimeout(() => {
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 300);
  };

  input?.addEventListener("focus", handler);
  return () => input?.removeEventListener("focus", handler);
}, []);

  useEffect(() => {
    const fetchMessages = async () => {
      if (!user?.id || !ownerId) return;
      try {
        setLoading(true);
        const response = await fetch(
          getApiUrl(`/api/messages?userId=${user.id}&otherUserId=${ownerId}`)
        );
        if (response.ok) {
          const data = await response.json();
          setMessages(data);
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [user?.id, ownerId]);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

 return (
  <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">

    {/* HEADER */}
    <div className="flex-shrink-0 bg-green-600 text-white px-4 py-3 flex items-center gap-3 z-10">
      <Link href={`/machinery-details?id=${machineryId}`}>
        <ArrowLeft className="w-6 h-6 cursor-pointer" />
      </Link>

      <div>
        <h1 className="font-bold text-lg">Chat with Owner</h1>
        <p className="text-sm text-green-100">{ownerName}</p>
      </div>
    </div>

    {/* SCROLLABLE MESSAGE AREA */}
    <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
      {loading && (
        <p className="text-gray-500 text-center text-sm">
          Loading messages...
        </p>
      )}

      {!loading && messages.length === 0 && (
        <div className="h-full flex items-center justify-center">
          <p className="text-gray-400 text-sm text-center">
            No messages yet.
            <br />
            Start the conversation!
          </p>
        </div>
      )}

      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${
            msg.sender_id === user?.id
              ? 'justify-end'
              : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
              msg.sender_id === user?.id
                ? 'bg-green-500 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-900 rounded-bl-sm'
            }`}
          >
            <p>{msg.message}</p>

            <p
              className={`text-xs mt-1 ${
                msg.sender_id === user?.id
                  ? 'text-green-100'
                  : 'text-gray-400'
              }`}
            >
              {new Date(msg.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      ))}

      <div ref={messagesEndRef} />
    </div>

    {/* INPUT */}
    <div className="flex-shrink-0 border-t bg-white px-4 py-3 flex items-center gap-2 sticky bottom-0">
      <input
        type="text"
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
        onKeyDown={(e) =>
          e.key === 'Enter' && handleSendMessage()
        }
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