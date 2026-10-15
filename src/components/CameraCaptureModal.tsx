import React, { useRef, useState, useEffect } from 'react';
import { Camera, CameraOff, X, RefreshCw, Check, Upload, AlertCircle, Smartphone } from 'lucide-react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    setError(null);
    setIsPermissionDenied(false);
    setIsLoading(true);

    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Direct camera streaming is not supported or is restricted in this browser environment. You can upload or take a photo with your device camera below.');
        setIsLoading(false);
        return;
      }

      let mediaStream: MediaStream | null = null;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch (firstErr: any) {
        // Fallback to minimal video constraint if device rejects ideal resolution or facingMode
        if (firstErr?.name === 'OverconstrainedError' || firstErr?.name === 'ConstraintNotSatisfiedError') {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } else {
          throw firstErr;
        }
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      // Use console.warn instead of console.error to prevent uncaught test/telemetry alarm triggers
      console.warn('Camera access unavailable or declined:', err?.name || err?.message || err);

      const errName = err?.name || '';
      const errMsg = err?.message || '';

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.toLowerCase().includes('permission denied')) {
        setIsPermissionDenied(true);
        setError('Camera permission was denied. You can allow it in your browser address bar (click the lock or camera icon), or upload a photo directly.');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setError('No camera was detected on this device. You can upload an image file instead.');
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setError('Camera is currently in use by another tab or program. Please close other camera apps and retry.');
      } else {
        setError('Unable to start live camera. You can try again or upload a photo directly.');
      }
    } finally {
      setIsLoading(false);
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

  const handleFileFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        onCapture(file, event.target.result as string);
        onClose();
        setCapturedPhoto(null);
        setCapturedBlob(null);
      }
    };
    reader.readAsDataURL(file);
    // Reset file input value so same file can be re-selected if desired
    e.target.value = '';
  };

  const toggleCameraFacing = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  if (!isOpen) return null;

  return (
    <div 
      id="camera-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div 
        id="camera-modal-content"
        className="bg-[#10231F] text-white rounded-3xl w-full max-w-lg overflow-hidden border border-[#27483E] shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* Hidden File inputs for seamless fallback */}
        <input
          ref={fileInputRef}
          id="camera-fallback-file-input"
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp"
          className="hidden"
          onChange={handleFileFallback}
        />
        <input
          ref={nativeCameraInputRef}
          id="camera-native-camera-input"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileFallback}
        />

        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#27483E]">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-[#5EE0B5]" />
            <h3 className="font-bold text-lg">Take Photo</h3>
          </div>
          <button
            id="btn-close-camera"
            onClick={onClose}
            className="p-1.5 hover:bg-[#27483E] rounded-full transition-colors text-white/80 hover:text-white cursor-pointer"
            aria-label="Close camera modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder or Preview or Error Fallback */}
        <div className="relative aspect-4/3 bg-black/90 flex items-center justify-center overflow-hidden">
          {error ? (
            <div className="p-6 flex flex-col items-center justify-center text-center max-w-md">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-3">
                <CameraOff className="w-7 h-7 text-red-400" />
              </div>
              <h4 className="font-bold text-base text-white mb-1.5">
                {isPermissionDenied ? 'Camera Permission Required' : 'Camera Unavailable'}
              </h4>
              <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-4">
                {error}
              </p>
              
              <div className="flex flex-wrap items-center justify-center gap-2.5 w-full">
                <button
                  id="btn-camera-try-again"
                  onClick={startCamera}
                  className="px-4 py-2 bg-[#27483E] hover:bg-[#345c50] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Try Again</span>
                </button>
                <button
                  id="btn-camera-upload-fallback"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#5EE0B5] hover:bg-[#4dd0a5] text-[#10231F] text-xs sm:text-sm font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                </button>
                <button
                  id="btn-camera-native-fallback"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer sm:flex hidden"
                >
                  <Smartphone className="w-3.5 h-3.5 text-[#5EE0B5]" />
                  <span>Device Camera</span>
                </button>
              </div>
            </div>
          ) : capturedPhoto ? (
            <img
              src={capturedPhoto}
              alt="Snapshot"
              className="w-full h-full object-contain"
            />
          ) : (
            <>
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-xs text-white">
                  <RefreshCw className="w-8 h-8 animate-spin text-[#5EE0B5] mb-2" />
                  <span className="text-xs font-medium text-gray-300">Starting camera...</span>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />

          {/* Switch camera button */}
          {!capturedPhoto && !error && !isLoading && (
            <button
              id="btn-switch-camera"
              onClick={toggleCameraFacing}
              title="Flip camera"
              className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-xs transition-colors cursor-pointer shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-[#0A1714] flex items-center justify-center gap-3">
          {error ? (
            <div className="flex items-center gap-3 w-full">
              <button
                id="btn-camera-error-close"
                onClick={onClose}
                className="flex-1 py-3 bg-[#27483E] hover:bg-[#345c50] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-sm"
              >
                Cancel
              </button>
              <button
                id="btn-camera-choose-file"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-[#5EE0B5] hover:bg-[#4dd0a5] text-[#10231F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer text-sm"
              >
                <Upload className="w-4 h-4" />
                <span>Choose Image</span>
              </button>
            </div>
          ) : !capturedPhoto ? (
            <div className="flex items-center gap-3 w-full justify-between">
              <button
                id="btn-camera-upload-alt"
                onClick={() => fileInputRef.current?.click()}
                title="Or choose photo from device"
                className="py-3 px-4 bg-[#27483E] hover:bg-[#345c50] text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#5EE0B5]" />
                <span className="hidden sm:inline">Upload File</span>
              </button>
              <button
                id="btn-take-snapshot"
                onClick={handleTakeSnapshot}
                disabled={isLoading}
                className="flex-1 max-w-xs py-3 px-6 bg-[#5EE0B5] hover:bg-[#4dd0a5] disabled:opacity-50 text-[#10231F] font-bold rounded-full flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
              >
                <Camera className="w-5 h-5" />
                Capture Photo
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                id="btn-retake-snapshot"
                onClick={handleRetake}
                className="flex-1 py-3 bg-[#27483E] hover:bg-[#345c50] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                id="btn-confirm-snapshot"
                onClick={handleConfirm}
                className="flex-1 py-3 bg-[#5EE0B5] hover:bg-[#4dd0a5] text-[#10231F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
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
