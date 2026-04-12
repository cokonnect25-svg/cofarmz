'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef, Suspense } from 'react';
import { Trash2, ArrowLeft, Video, Upload as UploadIcon, X, Plus, Eye, EyeOff } from 'lucide-react';

interface Reel {
  id: string;
  video_url: string;
  thumbnail_url: string;
  caption: string;
  likes: number;
  comments: number;
  created_at: string;
}

function MyReelsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [step, setStep] = useState<'list' | 'upload' | 'edit'>('list');
  const [caption, setCaption] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'upload') {
      setStep('upload');
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;

    const fetchReels = async () => {
      try {
        const res = await fetch(
          `/api/reels?userId=${user.id}&limit=20`
        );
        if (res.ok) {
          const response = await res.json();
          // Handle both old and new API response formats
          setReels(Array.isArray(response) ? response : response.data || []);
        } else {
          const errorData = await res.json();
          console.error('Failed to fetch my reels:', res.status, errorData);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Failed to fetch my reels:', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchReels();
  }, [user]);

  const handleRecordVideo = async () => {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const video = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      });

      if (video.webPath) {
        setVideoPreview(video.webPath);
        setVideoUrl(video.webPath);
        setStep('edit');
      }
    } catch (error) {
      console.error('Error recording video:', error);
    }
  };

  const handleUploadVideo = () => {
    fileInputRef.current?.click();
  };

  const handleVideoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      alert('Please select a valid video file');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('Video file must be less than 100MB');
      return;
    }

    setVideoFile(file);
    const preview = URL.createObjectURL(file);
    setVideoPreview(preview);
    setStep('edit');
  };

  const handleUploadReel = async () => {
    if (!user) return;

    if (!videoFile && !videoUrl) {
      alert('Please select a video');
      return;
    }

    setUploading(true);
    try {
      let finalVideoUrl = videoUrl;

      if (videoFile) {
        const formData = new FormData();
        formData.append('file', videoFile);

        const uploadRes = await fetch(
          `/api/upload`,
          {
            method: 'POST',
            body: formData,
          }
        );

        if (!uploadRes.ok) {
          throw new Error('Failed to upload video file');
        }

        const uploadData = await uploadRes.json();
        finalVideoUrl = uploadData.url;
      }

      const res = await fetch(
        `/api/reels`,
        {
          method: 'POST',
          headers: { 'x-user-id': user.id },
          body: JSON.stringify({
            videoUrl: finalVideoUrl,
            caption,
            thumbnailUrl: 'https://via.placeholder.com/270x480'
          })
        }
      );

      if (res.ok) {
        const newReel = await res.json();
        setReels([newReel, ...reels]);
        resetForm();
        alert('Reel uploaded successfully!');
      } else {
        throw new Error('Failed to create reel');
      }
    } catch (error) {
      console.error('Error uploading reel:', error);
      alert('Failed to upload reel. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setStep('list');
    setCaption('');
    setVideoUrl('');
    setVideoFile(null);
    setVideoPreview(null);
    setUploadProgress(0);
  };

  if (!user) {
    router.push('/login');
    return null;
  }

  // Step 1: Upload Selection Screen
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Premium Sticky Header */}
        <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-gray-100 px-6 py-5 flex items-center justify-between z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setStep('list')} 
              className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 active:scale-95 transition-transform border border-gray-100 hover:bg-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-black text-gray-900 tracking-tight">Create Reel</h1>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Creative Options */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-8">
          <div className="w-full text-center">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Share your story</h2>
            <p className="text-gray-500 text-sm">How would you like to share your content?</p>
          </div>

          <div className="grid grid-cols-1 w-full gap-4">
            <button
              onClick={handleRecordVideo}
              className="group w-full p-8 bg-white border border-gray-100 rounded-[32px] hover:border-emerald-500/30 transition-all duration-300 flex items-center gap-6 active:scale-[0.98] shadow-soft hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                <Video className="w-7 h-7" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-900 text-lg leading-none mb-1.5">Record Reel</p>
                <p className="text-sm text-gray-400 font-medium">Capture a new moment</p>
              </div>
              <div className="ml-auto w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-emerald-500" />
              </div>
            </button>

            <button
              onClick={handleUploadVideo}
              className="group w-full p-8 bg-white border border-gray-100 rounded-[32px] hover:border-blue-500/30 transition-all duration-300 flex items-center gap-6 active:scale-[0.98] shadow-soft hover:shadow-xl"
            >
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center transition-colors group-hover:bg-blue-600 group-hover:text-white">
                <UploadIcon className="w-7 h-7" />
              </div>
              <div className="text-left">
                <p className="font-black text-gray-900 text-lg leading-none mb-1.5">Upload Video</p>
                <p className="text-sm text-gray-400 font-medium">Import from gallery</p>
              </div>
              <div className="ml-auto w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                <Plus className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
              </div>
            </button>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoFileSelect}
          className="hidden"
        />
      </div>
    );
  }

  // Step 2: Edit & Caption Screen
  // Step 2: Final Details Screen
  if (step === 'edit') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 z-40">
          <button onClick={() => resetForm()} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 transition active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-black text-gray-900 tracking-tight">Final Details</h1>
          <button
            onClick={handleUploadReel}
            disabled={uploading}
            className="px-6 py-2.5 bg-emerald-600 text-white rounded-full font-bold text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {uploading ? `Posting...` : 'Post'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Video Preview with Glassmorphism Overlay */}
          {videoPreview && (
            <div className="p-6">
              <div className="relative w-full aspect-[9/16] max-h-[400px] bg-black rounded-[40px] overflow-hidden shadow-2xl mx-auto border-4 border-white shadow-soft">
                <video
                  ref={videoRef}
                  src={videoPreview}
                  className="w-full h-full object-cover"
                  controls={false}
                  autoPlay
                  muted
                  loop
                  preload="metadata"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none"></div>
                <div className="absolute top-5 left-5 bg-black/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                  <span className="text-white text-[10px] font-black uppercase tracking-[0.2em] leading-none">Preview</span>
                </div>
              </div>
            </div>
          )}

          {/* Form Content */}
          <div className="p-8 space-y-8">
            <div className="space-y-4">
              <label className="flex items-center gap-2.5 text-[11px] font-black text-gray-400 uppercase tracking-[0.15em] px-1">
                <i className="ph ph-text-aa text-emerald-600 text-lg"></i>
                Add Caption
              </label>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What's happening on the farm?"
                maxLength={150}
                className="w-full px-6 py-5 bg-gray-50 border-none rounded-[28px] focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none text-gray-900 placeholder-gray-400 font-medium leading-relaxed"
                rows={4}
              />
              <div className="flex justify-end pr-2">
                <span className={`text-[11px] font-black tracking-widest ${caption.length > 140 ? 'text-red-500' : 'text-gray-300'}`}>
                  {caption.length} / 150
                </span>
              </div>
            </div>

            <div className="bg-emerald-50/50 rounded-[32px] p-6 border border-emerald-100/50 flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <i className="ph-fill ph-lightbulb text-emerald-600 text-xl"></i>
              </div>
              <p className="text-emerald-800 text-[13px] font-bold leading-relaxed">
                Add emojis and clear descriptions to get 2x more interaction on your reels!
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Main Reels List
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Premium Sticky Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-xl border-b border-gray-100 px-6 py-5 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-900 active:scale-95 transition-transform border border-gray-100 hover:bg-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight">My Reels</h1>
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{reels.length} Videos shared</p>
          </div>
        </div>
        <button
          onClick={() => setStep('upload')}
          className="w-10 h-10 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center active:scale-90 transition-transform hover:bg-emerald-700"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Professional Empty State */}
      {reels.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 px-10">
          <div className="relative mb-8">
            <div className="w-24 h-24 bg-emerald-50 rounded-[32px] flex items-center justify-center border border-emerald-100/50 shadow-inner">
              <Video className="w-10 h-10 text-emerald-400 opacity-60" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-white rounded-2xl shadow-float flex items-center justify-center text-emerald-600">
              <Plus className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-2xl font-black text-gray-900 text-center mb-3 tracking-tight">
            Ready to show off your work?
          </h2>
          <p className="text-gray-500 text-center text-sm leading-relaxed mb-10 max-w-[280px]">
            Share your farming journey, tips, or daily life with the community through short reels.
          </p>
          <button
            onClick={() => setStep('upload')}
            className="w-full max-w-[240px] px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-500/30 hover:bg-emerald-700 transition active:scale-95 flex items-center justify-center gap-3"
          >
            <Video className="w-5 h-5" />
            Create Your First Reel
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 p-6">
          {reels.map((reel) => (
            <div
              key={reel.id}
              className="relative aspect-[9/16] rounded-3xl overflow-hidden bg-gray-50 group cursor-pointer shadow-sm hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border border-gray-100"
              onClick={() => router.push(`/reels?reelId=${reel.id}&userId=${user.id}`)}
            >
              {/* Thumbnail fallback */}
              <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <Video className="w-8 h-8 text-gray-300 opacity-40" />
              </div>
              <img
                src={reel.thumbnail_url || `https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=700&fit=crop&q=80`}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />

              {/* Interaction Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-90 transition-opacity">
                {/* Stats */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-col gap-2">
                  <div className="flex gap-4 text-white text-xs font-black drop-shadow-md">
                    <span className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                      <i className="ph-fill ph-heart text-red-500 text-sm"></i> {reel.likes}
                    </span>
                    <span className="flex items-center gap-1.5 bg-black/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10">
                      <i className="ph-fill ph-chat-circle text-white text-sm"></i> {reel.comments}
                    </span>
                  </div>
                  {reel.caption && (
                    <p className="text-white text-[11px] font-medium mt-1 line-clamp-1 drop-shadow-sm opacity-90">{reel.caption}</p>
                  )}
                </div>
              </div>

              {/* Delete Button */}
              <div className="absolute top-3 right-3 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] group-hover:translate-y-0">
                <button 
                  onClick={(e) => { e.stopPropagation(); /* show delete logic */ }}
                  className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 active:scale-95 border border-red-400"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="absolute top-3 left-3 bg-white/10 backdrop-blur-md p-2 rounded-[14px] border border-white/20">
                <Video className="w-4 h-4 text-white" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="h-20"></div>
    </div>
  );
}

export default function MyReelsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    }>
      <MyReelsContent />
    </Suspense>
  );
}
