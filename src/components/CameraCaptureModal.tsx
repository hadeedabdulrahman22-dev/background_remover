import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, dataUrl: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  useEffect(() => {
    if (isOpen && !capturedPhoto) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode, capturedPhoto]);

  const startCamera = async () => {
    setError(null);
    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Unable to access your camera. Please ensure camera permissions are allowed.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const handleTakeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          setCapturedBlob(blob);
          setCapturedPhoto(dataUrl);
          stopCamera();
        }
      },
      'image/jpeg',
      0.95
    );
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedBlob(null);
  };

  const handleConfirm = () => {
    if (capturedBlob && capturedPhoto) {
      onCapture(capturedBlob, capturedPhoto);
      onClose();
      setCapturedPhoto(null);
      setCapturedBlob(null);
    }
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div 
      id="camera-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div 
        id="camera-modal-content"
        className="bg-[#10231F] text-white rounded-3xl w-full max-w-lg overflow-hidden border border-[#27483E] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27483E]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#5EE0B5]" />
            <h3 className="font-bold text-lg">Take Photo</h3>
          </div>
          <button
            id="btn-close-camera"
            onClick={onClose}
            className="p-1.5 hover:bg-[#27483E] rounded-full transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder or Preview */}
        <div className="relative aspect-4/3 bg-black flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 text-center text-red-300 text-sm">
              {error}
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Snapshot"
              className="w-full h-full object-contain"
            />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Switch camera button */}
          {!capturedPhoto && !error && (
            <button
              id="btn-switch-camera"
              onClick={toggleCameraFacing}
              title="Flip camera"
              className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-[#0A1714] flex items-center justify-center gap-4">
          {!capturedPhoto ? (
            <button
              id="btn-take-snapshot"
              onClick={handleTakeSnapshot}
              disabled={!!error}
              className="px-6 py-3 bg-[#5EE0B5] hover:bg-[#4dd0a5] disabled:opacity-50 text-[#10231F] font-bold rounded-full flex items-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              <Camera className="w-5 h-5" />
              Capture Photo
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                id="btn-retake-snapshot"
                onClick={handleRetake}
                className="flex-1 py-3 bg-[#27483E] hover:bg-[#345c50] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                id="btn-confirm-snapshot"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-[#5EE0B5] hover:bg-[#4dd0a5] text-[#10231F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors"
              >
                <Check className="w-5 h-5" />
                Use Photo
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
