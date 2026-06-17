'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, Suspense, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import {
  Send, ArrowLeft, Trash2, Check, CheckCheck, MoreVertical,
  Image, Video, MapPin, Paperclip, X, FileText,
  Download, Play, Pause, Camera, MapPinned, Files
} from 'lucide-react';
import { getApiUrl } from '@/lib/api';

const TOP_NAV_H = 64;
const BOTTOM_NAV_H = 60;

type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'location';

interface Message {
  id: number;
  sender_id: string;
  receiver_id: string;
  message?: string;
  message_type: MessageType;
  media_url?: string;
  media_thumbnail?: string;
  file_name?: string;
  file_size?: number;
  latitude?: number;
  longitude?: string | number;
  location_name?: string;
  duration?: number;
  created_at: string;
  read_at?: string | null;
}

// ── Safe number parser ───────────────────────────────────────
function safeNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  const n = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(n) ? 0 : n;
}

// ── Safe date formatter ────────────────────────────────────
function safeTime(dateStr: any): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

// ── Online Status Hook ─────────────────────────────────────
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
        ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', userId }));
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'presence' && data.userId === userId) {
              setIsOnline(data.isOnline);
              setLastSeen(data.lastSeen);
            }
          } catch {}
        };
        ws.onclose = () => {
          setIsOnline(false);
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = setTimeout(connect, 5000);
        };
        ws.onerror = () => ws.close();
        wsRef.current = ws;
      } catch {}
    };
    connect();
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

// ── Format helpers ───────────────────────────────────────────
function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'offline';
  try {
    const date = new Date(lastSeen);
    if (isNaN(date.getTime())) return 'offline';
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
  } catch {
    return 'offline';
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Media Preview Modal ────────────────────────────────────
function MediaPreviewModal({ url, type, onClose }: { url: string; type: MessageType; onClose: () => void }) {
  if (!url) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition">
        <X className="w-6 h-6 text-white" />
      </button>
      <div onClick={(e) => e.stopPropagation()} className="max-w-full max-h-full">
        {type === 'image' && <img src={url} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg object-contain" />}
        {type === 'video' && <video src={url} className="max-w-full max-h-[85vh] rounded-lg" controls autoPlay playsInline />}
      </div>
    </div>
  );
}

// ── Location Preview ───────────────────────────────────────
function LocationPreview({ lat, lng, name }: { lat?: number; lng?: string | number; name?: string }) {
  const latitude = safeNumber(lat);
  const longitude = safeNumber(lng);
  const mapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;

  return (
    <a href={mapsUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
      className="block bg-blue-50 rounded-xl overflow-hidden border border-blue-200 hover:bg-blue-100 transition min-w-[200px]">
      <div className="h-24 bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center relative">
        <MapPin className="w-8 h-8 text-white drop-shadow-lg" />
        <div className="absolute bottom-1 right-2">
          <span className="text-[10px] text-white/80 font-medium">Open in Maps</span>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-bold text-blue-900 flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {name || 'Shared Location'}
        </p>
        <p className="text-[10px] text-blue-600 mt-0.5">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      </div>
    </a>
  );
}

// ── Audio Player ───────────────────────────────────────────
function AudioPlayer({ url, duration }: { url: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => {
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
    };
  }, []);

  const safeDuration = safeNumber(duration);
  const progress = safeDuration > 0 ? (currentTime / safeDuration) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={togglePlay} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
        {playing ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-white/70">{fmt(currentTime)}</span>
          <span className="text-[10px] text-white/70">{safeDuration > 0 ? fmt(safeDuration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
}

// ── Attachment Menu ────────────────────────────────────────
function AttachmentMenu({ onPhoto, onVideo, onFile, onLocation, onClose }: any) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [onClose]);

  const items = [
    { icon: Camera, label: 'Camera', sublabel: 'Take a photo', color: 'text-purple-600', bg: 'bg-purple-50', hoverBg: 'hover:bg-purple-100', border: 'border-purple-200', onClick: onPhoto },
    { icon: Video, label: 'Video', sublabel: 'Share a clip', color: 'text-red-600', bg: 'bg-red-50', hoverBg: 'hover:bg-red-100', border: 'border-red-200', onClick: onVideo },
    { icon: MapPinned, label: 'Location', sublabel: 'Share where you are', color: 'text-blue-600', bg: 'bg-blue-50', hoverBg: 'hover:bg-blue-100', border: 'border-blue-200', onClick: onLocation },
    { icon: Files, label: 'Document', sublabel: 'PDF, Word, etc.', color: 'text-orange-600', bg: 'bg-orange-50', hoverBg: 'hover:bg-orange-100', border: 'border-orange-200', onClick: onFile },
  ];

  return (
    <div ref={menuRef} className="absolute left-2 bottom-[calc(100%+12px)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-3 z-[70] min-w-[280px]"
      style={{ filter: 'drop-shadow(0 10px 40px rgba(0,0,0,0.15))' }}>
      <div className="flex items-center justify-between px-2 pb-3 mb-2 border-b border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Share</p>
        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition"><X className="w-4 h-4 text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, sublabel, color, bg, hoverBg, border, onClick }) => (
          <button key={label} onClick={() => { onClick(); onClose(); }}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${hoverBg} group`}>
            <div className={`w-12 h-12 rounded-xl ${bg} border ${border} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200 shadow-sm`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">{label}</p>
              <p className="text-[10px] text-gray-400 mt-0.5">{sublabel}</p>
            </div>
          </button>
        ))}
      </div>
      <div className="absolute left-6 -bottom-2 w-4 h-4 bg-white border-b border-r border-gray-100 rotate-45" />
    </div>
  );
}

// ── Location Picker Modal ──────────────────────────────────
function LocationPickerModal({ onSelect, onClose }: { onSelect: (lat: number, lng: number, name: string) => void; onClose: () => void }) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [name, setName] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(String(pos.coords.latitude)); setLng(String(pos.coords.longitude)); setName('Current Location'); setGettingLocation(false); },
      () => { alert('Unable to get location. Please enter manually.'); setGettingLocation(false); }
    );
  };

  const handleSubmit = () => {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) { alert('Please enter valid coordinates'); return; }
    onSelect(latitude, longitude, name || 'Shared Location');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600" />Share Location</h3>
        <button onClick={getCurrentLocation} disabled={gettingLocation}
          className="w-full py-3 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm mb-4 hover:bg-blue-100 transition flex items-center justify-center gap-2">
          <MapPin className="w-4 h-4" />{gettingLocation ? 'Getting location...' : 'Use Current Location'}
        </button>
        <div className="space-y-3">
          <div><label className="text-xs font-bold text-gray-500 mb-1 block">Location Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Farm, Warehouse..."
              className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Latitude</label>
              <input type="text" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="12.9716"
                className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
            <div><label className="text-xs font-bold text-gray-500 mb-1 block">Longitude</label>
              <input type="text" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="77.5946"
                className="w-full px-3 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30" /></div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition">Share</button>
        </div>
      </div>
    </div>
  );
}

// ── Upload Progress ─────────────────────────────────────────
function UploadProgress({ progress }: { progress: number }) {
  return (
    <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-2">
      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
        <Send className="w-4 h-4 text-green-600" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold text-gray-700">Uploading...</p>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-1">
          <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs font-bold text-gray-500">{progress}%</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
function MessagesContent() {
  const searchParams = useSearchParams();
  const ownerId = searchParams.get('ownerId');
  const machineryId = searchParams.get('machineryId');
  const ownerName = searchParams.get('ownerName');

  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
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

  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: MessageType } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isOnline, lastSeen } = useOnlineStatus(ownerId);

  const markAsRead = useCallback(async () => {
    if (!user?.id || !ownerId) return;
    try {
      await fetch(getApiUrl(`/api/messages/read`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, senderId: ownerId }),
      });
    } catch {}
  }, [user?.id, ownerId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 150) {
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
    }
  }, [messages]);

  const fetchMessages = useCallback(async () => {
    if (!user?.id || !ownerId) return;
    try {
      const response = await fetch(getApiUrl(`/api/messages?userId=${user.id}&otherUserId=${ownerId}`));
      if (response.ok) {
        const data = await response.json();
        // ✅ CRITICAL: Ensure data is array, filter out invalid items
        const safeMessages = Array.isArray(data) ? data.filter((m: any) => m && typeof m === 'object' && m.id != null) : [];
        setMessages(safeMessages);
        markAsRead();
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      setMessages([]);
    }
  }, [user?.id, ownerId, markAsRead]);

  useEffect(() => {
    setLoading(true);
    fetchMessages().then(() => setLoading(false));
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) setShowOptionsMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const uploadToR2 = async (file: File): Promise<{ url: string; fileName: string; fileSize: number; isVideo: boolean }> => {
    const formData = new FormData();
    formData.append('file', file);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          resolve({ url: data.url, fileName: data.filename, fileSize: file.size, isVideo: data.isVideo });
        } else reject(new Error('Upload failed'));
      });
      xhr.addEventListener('error', () => reject(new Error('Upload error')));
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
      xhr.open('POST', getApiUrl('/api/upload'));
      xhr.send(formData);
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !ownerId) return;
    await sendMessage({ message_type: 'text', message: newMessage.trim() });
  };

  const handleSendMedia = async (file: File, type: MessageType) => {
    if (!user?.id || !ownerId) return;
    setIsUploading(true);
    setUploadProgress(0);
    try {
      const uploadResult = await uploadToR2(file);
      await sendMessage({
        message_type: type,
        media_url: uploadResult.url,
        file_name: uploadResult.fileName,
        file_size: uploadResult.fileSize,
        message: newMessage.trim() || undefined,
      });
      setNewMessage('');
    } catch {
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSendLocation = async (lat: number, lng: number, name: string) => {
    await sendMessage({
      message_type: 'location',
      latitude: lat,
      longitude: String(lng),
      location_name: name,
      message: `📍 ${name}`,
    });
  };

  const sendMessage = async (payload: Partial<Message>) => {
    if (!user?.id || !ownerId) return;
    try {
      setSending(true);
      const response = await fetch(getApiUrl(`/api/messages`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: user.id,
          receiverId: ownerId,
          machineryId: machineryId || null,
          ...payload,
        }),
      });
      if (response.ok) {
        const newMsg = await response.json();
        if (newMsg && newMsg.id) setMessages((prev) => [...prev, newMsg]);
        if (payload.message_type === 'text') setNewMessage('');
      } else {
        const err = await response.json();
        alert(`Failed to send: ${err.error}`);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (type: MessageType) => {
    if (type === 'image') photoInputRef.current?.click();
    else if (type === 'video') videoInputRef.current?.click();
    else fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleSendMedia(file, type);
    e.target.value = '';
  };

  const handleDeleteMessage = async (msgId: number) => {
    if (!user?.id) return;
    setDeletingMsg(true);
    try {
      const res = await fetch(getApiUrl(`/api/messages/${msgId}?userId=${encodeURIComponent(user.id)}`), {
        method: 'DELETE',
        headers: { 'x-user-id': user.id },
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        setShowDeleteConfirm(null);
        setSelectedMessageId(null);
      } else {
        const data = await res.json();
        alert(`Failed to delete: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Network error deleting message');
    } finally {
      setDeletingMsg(false);
    }
  };

  const handleDeleteConversation = async () => {
    if (!user?.id || !ownerId) return;
    setDeletingConv(true);
    try {
      let res = await fetch(getApiUrl(`/api/messages/conversations`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'x-user-id': user.id },
        body: JSON.stringify({ userId: user.id, otherUserId: ownerId }),
      });

      if (!res.ok && res.status === 404) {
        res = await fetch(getApiUrl(`/api/messages?userId=${encodeURIComponent(user.id)}&otherUserId=${encodeURIComponent(ownerId)}`), {
          method: 'DELETE',
          headers: { 'x-user-id': user.id },
        });
      }

      if (res.ok) {
        setMessages([]);
        setShowConvDeleteConfirm(false);
        setShowOptionsMenu(false);
        window.location.href = '/chat';
      } else {
        const data = await res.json();
        alert(`Failed to delete conversation: ${data.error || 'Unknown error'}`);
      }
    } catch {
      alert('Error deleting conversation');
    } finally {
      setDeletingConv(false);
    }
  };

  const handleTouchStart = (msgId: number) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => setSelectedMessageId(msgId), 500);
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  // ── RENDER MESSAGE CONTENT ───────────────────────────────
  const renderMessageContent = (msg: Message, isOwn: boolean) => {
    // ✅ Guard against null/undefined message
    if (!msg) return null;

    switch (msg.message_type) {
      case 'image':
        return (
          <div className="cursor-pointer" onClick={() => msg.media_url && setPreviewMedia({ url: msg.media_url, type: 'image' })}>
            {msg.media_url && <img src={msg.media_url} alt="Shared image" className="max-w-[240px] rounded-lg object-cover" loading="lazy" />}
            {msg.message && msg.message !== '📷 Photo' && (
              <p className={`text-sm mt-1 ${isOwn ? 'text-white' : 'text-gray-900'}`}>{msg.message}</p>
            )}
          </div>
        );

      case 'video':
        return (
          <div className="cursor-pointer relative" onClick={() => msg.media_url && setPreviewMedia({ url: msg.media_url, type: 'video' })}>
            {msg.media_thumbnail ? (
              <img src={msg.media_thumbnail} alt="Video thumbnail" className="max-w-[240px] rounded-lg object-cover" />
            ) : (
              <div className="w-[240px] h-[160px] bg-gray-800 rounded-lg flex items-center justify-center"><Play className="w-10 h-10 text-white/80" /></div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"><Play className="w-5 h-5 text-white ml-0.5" /></div>
            </div>
            {msg.duration != null && (
              <span className="absolute bottom-2 right-2 text-[10px] font-bold text-white bg-black/50 px-1.5 py-0.5 rounded">
                {Math.floor(safeNumber(msg.duration) / 60)}:{(Math.floor(safeNumber(msg.duration) % 60)).toString().padStart(2, '0')}
              </span>
            )}
            {msg.message && msg.message !== '🎥 Video' && (
              <p className={`text-sm mt-1 ${isOwn ? 'text-white' : 'text-gray-900'}`}>{msg.message}</p>
            )}
          </div>
        );

      case 'audio':
        return (
          <div className="min-w-[200px]">
            {msg.media_url && <AudioPlayer url={msg.media_url} duration={msg.duration} />}
            {msg.message && <p className={`text-xs mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500'}`}>{msg.message}</p>}
          </div>
        );

      case 'file':
        return (
          <a href={msg.media_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-3 p-2 rounded-xl min-w-[200px] ${isOwn ? 'bg-white/10' : 'bg-gray-50'}`}>
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5 text-orange-500" /></div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold truncate ${isOwn ? 'text-white' : 'text-gray-900'}`}>{msg.file_name || 'Document'}</p>
              <p className={`text-[10px] ${isOwn ? 'text-green-200' : 'text-gray-500'}`}>{formatFileSize(msg.file_size)}</p>
            </div>
            <Download className={`w-4 h-4 flex-shrink-0 ${isOwn ? 'text-green-200' : 'text-gray-400'}`} />
          </a>
        );

      case 'location':
        // ✅ CRITICAL: Safe rendering with null checks
        return (
          <LocationPreview
            lat={msg.latitude}
            lng={msg.longitude}
            name={msg.location_name}
          />
        );

      default:
        return <p className="text-sm">{msg.message || ''}</p>;
    }
  };

  return (
    <div className="fixed left-0 right-0 flex flex-col bg-white"
      style={{ top: `calc(${TOP_NAV_H}px + env(safe-area-inset-top))`, bottom: `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom))` }}>
      {/* HEADER */}
      <div className="flex-shrink-0 bg-green-600 text-white px-4 py-3 flex items-center gap-3">
        <Link href={`/chat`}><ArrowLeft className="w-6 h-6 cursor-pointer" /></Link>
        <Link href={`/farmer-profile?id=${ownerId}`} className="relative">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">
            {ownerName ? ownerName.charAt(0).toUpperCase() : '?'}
          </div>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-green-600 ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/farmer-profile?id=${ownerId}`}>
            <h1 className="font-bold text-lg truncate hover:underline cursor-pointer">{ownerName || 'Chat'}</h1>
          </Link>
          <p className="text-xs text-green-100">
            {isOnline ? (
              <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Online</span>
            ) : (
              <span>Last seen {formatLastSeen(lastSeen)}</span>
            )}
          </p>
        </div>
        <div className="relative" ref={optionsRef}>
          <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="p-2 hover:bg-white/10 rounded-full transition"><MoreVertical className="w-5 h-5" /></button>
          {showOptionsMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[180px] z-50">
              <button onClick={() => { setShowConvDeleteConfirm(true); setShowOptionsMenu(false); }}
                className="w-full px-4 py-2.5 text-left text-red-600 text-sm font-semibold hover:bg-red-50 transition flex items-center gap-2">
                <Trash2 className="w-4 h-4" />Delete Conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MESSAGES AREA */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
        {loading && <p className="text-gray-500 text-center text-sm">Loading messages...</p>}
        {!loading && messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-400 text-sm text-center">No messages yet.<br />Start the conversation!</p>
          </div>
        )}
        {messages.map((msg) => {
          // ✅ Guard: skip invalid messages
          if (!msg || !msg.id) return null;
          const isOwn = msg.sender_id === user?.id;
          const isSelected = selectedMessageId === msg.id;

          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              onTouchStart={() => handleTouchStart(msg.id)} onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(msg.id)} onMouseUp={handleTouchEnd} onMouseLeave={handleTouchEnd}
              onContextMenu={(e) => { e.preventDefault(); setSelectedMessageId(msg.id); }}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm relative group ${
                isOwn
                  ? msg.message_type === 'location' ? 'bg-transparent p-0' : 'bg-green-500 text-white rounded-br-sm'
                  : msg.message_type === 'location' ? 'bg-transparent p-0' : 'bg-gray-100 text-gray-900 rounded-bl-sm'
              } ${isSelected ? 'ring-2 ring-blue-400' : ''}`}>
                {msg.message_type !== 'location' && (
                  <button onClick={() => setShowDeleteConfirm(msg.id)}
                    className={`absolute -top-2 ${isOwn ? '-left-2' : '-right-2'} w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center transition shadow-md z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    title="Delete message">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
                {renderMessageContent(msg, isOwn)}
                {msg.message_type !== 'location' && (
                  <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <p className={`text-xs ${isOwn ? 'text-green-100' : 'text-gray-400'}`}>{safeTime(msg.created_at)}</p>
                    {isOwn && (
                      <span className="ml-1">
                        {msg.read_at ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" /> : <Check className="w-3.5 h-3.5 text-green-200" />}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

{/* INPUT AREA */}
<div className="flex-shrink-0 border-t bg-white px-4 py-3">
  {isUploading && <UploadProgress progress={uploadProgress} />}
  
  <div className="flex items-center gap-2">
    {/* Attachment button */}
    <div className="relative flex-shrink-0">
      <button
        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
        disabled={isUploading}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-50 ${
          showAttachmentMenu ? 'bg-green-100 text-green-600 rotate-45' : 'hover:bg-gray-100 text-gray-500'
        }`}
        style={{ transition: 'all 0.2s ease' }}
      >
        <Paperclip className="w-5 h-5" />
      </button>
      
            {showAttachmentMenu && (
              <AttachmentMenu onPhoto={() => handleFileSelect('image')} onVideo={() => handleFileSelect('video')}
                onFile={() => handleFileSelect('file')} onLocation={() => { setShowLocationPicker(true); setShowAttachmentMenu(false); }}
                onClose={() => setShowAttachmentMenu(false)} />
            )}
    </div>

    {/* Text input */}
    <input
      type="text"
      value={newMessage}
      onChange={(e) => setNewMessage(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && !isUploading && handleSendMessage()}
      placeholder={isUploading ? 'Uploading...' : 'Type a message...'}
      className="flex-1 px-4 py-2.5 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30"
      disabled={isUploading}
    />

    {/* Send button */}
    <button
      onClick={handleSendMessage}
      disabled={sending || isUploading || !newMessage.trim()}
      className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center disabled:opacity-40 transition hover:bg-green-700 flex-shrink-0"
    >
      <Send className="w-4 h-4 text-white" />
    </button>
  </div>
</div>

      {previewMedia && <MediaPreviewModal url={previewMedia.url} type={previewMedia.type} onClose={() => setPreviewMedia(null)} />}
      {showLocationPicker && <LocationPickerModal onSelect={handleSendLocation} onClose={() => setShowLocationPicker(false)} />}
      <input
          type="file"
          accept="image/*"
          ref={photoInputRef}
          className="hidden"
          onChange={(e) => onFileChange(e, 'image')}
        />
        <input
          type="file"
          accept="video/*"
          ref={videoInputRef}
          className="hidden"
          onChange={(e) => onFileChange(e, 'video')}
        />
        <input
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
          ref={fileInputRef}
          className="hidden"
          onChange={(e) => onFileChange(e, 'file')}
        />
      {showDeleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Message?</h3>
            <p className="text-sm text-gray-500 mb-5">This message will be removed for you. Others may still see it.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              <button onClick={() => handleDeleteMessage(showDeleteConfirm)} disabled={deletingMsg}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">{deletingMsg ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
      {showConvDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-black text-gray-900 mb-2">Delete Conversation?</h3>
            <p className="text-sm text-gray-500 mb-5">All messages with {ownerName} will be permanently deleted. This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConvDeleteConfirm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Keep</button>
              <button onClick={handleDeleteConversation} disabled={deletingConv}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">{deletingConv ? 'Deleting...' : 'Delete All'}</button>
            </div>
          </div>
        </div>
      )}
      {/* Hidden file inputs for attachment menu */}

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
