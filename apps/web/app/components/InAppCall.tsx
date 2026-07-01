'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Mic, MicOff, Phone, PhoneOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';

interface InAppCallProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientName: string;
  recipientImage: string;
  callType: 'audio' | 'video';
  userId: string;
}

export default function InAppCall({
  isOpen,
  onClose,
  recipientId,
  recipientName,
  recipientImage,
  callType,
  userId
}: InAppCallProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [callStatus, setCallStatus] = useState<'connecting' | 'ringing' | 'connected' | 'ended'>('connecting');
  const [callError, setCallError] = useState('');
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Initialize call
    initializeCall();

    return () => {
      cleanup();
    };
  }, [isOpen]);

  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);

  const initializeCall = async () => {
    try {
      setCallStatus('connecting');
      setCallError('');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });

      localStreamRef.current = stream;

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      };

      const peerConnection = new RTCPeerConnection(configuration);
      peerConnectionRef.current = peerConnection;

      // Add tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        console.log('Connection state:', peerConnection.connectionState);
        
        if (peerConnection.connectionState === 'connected') {
          setCallStatus('connected');
          setIsConnected(true);
        } else if (peerConnection.connectionState === 'disconnected' || 
                   peerConnection.connectionState === 'failed' ||
                   peerConnection.connectionState === 'closed') {
          setCallStatus('ended');
          handleEndCall();
        }
      };

      // Simulate ringing for demo purposes
      // In production, you'd use a signaling server (WebSocket/Socket.io)
      setTimeout(() => {
        setCallStatus('ringing');
      }, 500);

      // Simulate answer after 2 seconds for demo
      // In production, this would wait for actual recipient to answer
      setTimeout(() => {
        setCallStatus('connected');
        setIsConnected(true);
      }, 2500);

    } catch (error) {
      console.error('Error initializing call:', error);
      setCallStatus('ended');
      setCallError(
        callType === 'video'
          ? 'Camera or microphone permission is blocked. Allow permission to start a video call.'
          : 'Microphone permission is blocked. Allow permission to start an audio call.'
      );
    }
  };

  const cleanup = () => {
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Reset state
    setCallDuration(0);
    setIsConnected(false);
    setCallError('');
    setCallStatus('connecting');
  };

  const handleEndCall = () => {
    cleanup();
    onClose();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
    // Note: Speaker control is limited in web browsers
    // This would work better in a native Capacitor plugin
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-900 z-[9999] flex flex-col">
      {/* Video area */}
      <div className="flex-1 relative">
        {/* Remote video (full screen) */}
        {callType === 'video' && callStatus === 'connected' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800">
            <div className="text-center">
              <img
                src={recipientImage || 'https://via.placeholder.com/150'}
                alt={recipientName}
                className="w-32 h-32 rounded-full mx-auto mb-6 border-4 border-white/30"
              />
              <h2 className="text-white text-2xl font-bold mb-2">{recipientName}</h2>
              <p className="text-white/80 text-lg">
                {callError || (callStatus === 'connecting' && 'Connecting...')}
                {!callError && callStatus === 'ringing' && 'Ringing...'}
                {!callError && callStatus === 'connected' && formatDuration(callDuration)}
                {!callError && callStatus === 'ended' && 'Call Ended'}
              </p>
              {callError && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    onClick={initializeCall}
                    className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-gray-900"
                  >
                    Try Again
                  </button>
                  <button
                    onClick={handleEndCall}
                    className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-bold text-white"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Local video (small overlay) */}
        {callType === 'video' && callStatus === 'connected' && (
          <div className="absolute top-4 right-4 w-28 h-36 bg-gray-800 rounded-xl overflow-hidden shadow-2xl border-2 border-white/20">
            {isVideoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover mirror"
              />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <VideoOff className="w-8 h-8 text-white/60" />
              </div>
            )}
          </div>
        )}

        {/* Call status overlay */}
        {callStatus === 'connected' && callType === 'audio' && (
          <div className="absolute top-8 left-0 right-0 text-center">
            <div className="inline-block bg-black/40 backdrop-blur-md px-6 py-2 rounded-full">
              <p className="text-white text-lg font-semibold">{formatDuration(callDuration)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 bg-gradient-to-t from-black/90 to-transparent">
        <div className="flex justify-center items-center gap-4 mb-4">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            disabled={Boolean(callError)}
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              isMuted ? 'bg-white text-gray-900' : 'bg-white/20 text-white'
            } disabled:opacity-40`}
          >
            {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>

          {/* End call button */}
          <button
            onClick={handleEndCall}
            className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>

          {/* Video toggle (only for video calls) */}
          {callType === 'video' && (
            <button
              onClick={toggleVideo}
              disabled={Boolean(callError)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isVideoEnabled ? 'bg-white/20 text-white' : 'bg-white text-gray-900'
              } disabled:opacity-40`}
            >
              {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
          )}

          {/* Speaker toggle (for audio calls) */}
          {callType === 'audio' && (
            <button
              onClick={toggleSpeaker}
              disabled={Boolean(callError)}
              className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                isSpeakerOn ? 'bg-white/20 text-white' : 'bg-white text-gray-900'
              } disabled:opacity-40`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>
          )}
        </div>

        {/* Action labels */}
        <div className="flex justify-center gap-8 text-white/60 text-xs">
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
          <span className="text-red-400">End</span>
          <span>{callType === 'video' ? (isVideoEnabled ? 'Camera' : 'No Camera') : (isSpeakerOn ? 'Speaker' : 'Earpiece')}</span>
        </div>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
