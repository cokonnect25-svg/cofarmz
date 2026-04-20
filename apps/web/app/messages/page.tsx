'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
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

  // Fetch messages
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
    const interval = setInterval(fetchMessages, 3000); // Poll every 3 seconds
    return () => clearInterval(interval);
  }, [user?.id, ownerId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !ownerId) return;

    try {
      setSending(true);
      const response = await fetch(
        getApiUrl(`/api/messages`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderId: user.id,
            receiverId: ownerId,
            machineryId: machineryId,
            message: newMessage,
          }),
        }
      );

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
    <div className="flex flex-col min-h-[100dvh] bg-white">
      {/* Header */}
      <div className="bg-green-600 text-white p-4 flex items-center gap-3">
        <Link href={`/machinery-details?id=${machineryId}`}>
          <ArrowLeft className="w-6 h-6 cursor-pointer" />
        </Link>
        <div>
          <h1 className="font-bold text-lg">Chat with Owner</h1>
          <p className="text-sm text-green-100">{ownerName}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <p className="text-gray-500 text-center">Loading messages...</p>}
        {!loading && messages.length === 0 && (
          <p className="text-gray-500 text-center mt-10">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender_id === user?.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs px-4 py-2 rounded-lg ${
                msg.sender_id === user?.id
                  ? 'bg-green-500 text-white rounded-br-none'
                  : 'bg-gray-200 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="text-sm">{msg.message}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.sender_id === user?.id
                    ? 'text-green-100'
                    : 'text-gray-500'
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
      </div>

      {/* Input */}
      <div className="border-t p-4 flex gap-2 bg-gray-50">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={sending}
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          <Send className="w-5 h-5" />
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
