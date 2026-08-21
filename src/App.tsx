import React, { useState } from 'react';
import { WorkState, BackgroundOption, AppMode } from './types';
import { Header } from './components/Header';
import { PreviewCard } from './components/PreviewCard';
import { FeatureStrip } from './components/FeatureStrip';
import { BackgroundCustomizer, PRESET_BACKGROUNDS } from './components/BackgroundCustomizer';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { BatchProcessor } from './components/BatchProcessor';
import { exportImage, removeBackgroundClientSide, applyCropToImage, removeBackgroundServer } from './utils/imageUtils';
import { Sparkles, Download, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';

const MAX_BYTES = 25 * 1024 * 1024; // 25MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

export const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('single');
  const [state, setState] = useState<WorkState>('empty');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [selectedBg, setSelectedBg] = useState<BackgroundOption>(PRESET_BACKGROUNDS[0]);
  const [customColor, setCustomColor] = useState<string>('#FFFFFF');
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const showNotification = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  const handleCropApply = async (cropRect: { x: number; y: number; width: number; height: number }) => {
    try {
      showNotification('Applying crop...', 'info');
      let newSourceUrl = sourceUrl;
      let newResultUrl = resultUrl;
      let newSourceFile = sourceFile;

      if (sourceUrl) {
        const croppedSourceBlob = await applyCropToImage(sourceUrl, cropRect);
        newSourceUrl = URL.createObjectURL(croppedSourceBlob);
        if (sourceFile) {
          newSourceFile = new File([croppedSourceBlob], sourceFile.name, { type: croppedSourceBlob.type });
        } else {
          newSourceFile = new File([croppedSourceBlob], fileName || 'cropped.png', { type: croppedSourceBlob.type });
        }
      }

      if (resultUrl) {
        const croppedResultBlob = await applyCropToImage(resultUrl, cropRect);
        newResultUrl = URL.createObjectURL(croppedResultBlob);
      }

      // We won't revoke the old object URLs immediately as the UI needs a split second to render the new ones.
      // But for production, this should ideally have lifecycle management.
      
      setSourceUrl(newSourceUrl);
      setSourceFile(newSourceFile);
      if (newResultUrl) setResultUrl(newResultUrl);
      
      setIsCropping(false);
      showNotification('Image cropped successfully!', 'success');
    } catch (err: any) {
      console.error(err);
      setIsCropping(false);
      showNotification('Failed to crop image.', 'error');
    }
  };

  const handleSelectFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.includes(ext) && !file.type.startsWith('image/')) {
      showNotification('Please choose a JPG, JPEG, PNG, or WEBP image.', 'error');
      return;
    }
    if (file.size > MAX_BYTES) {
      showNotification('That image is larger than the 25 MB limit.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setSourceFile(file);
        setSourceUrl(e.target.result as string);
        setFileName(file.name);
        setFileSize(file.size);
        setResultUrl(null);
        setState('ready');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectSample = async (url: string, name: string) => {
    try {
      showNotification('Loading sample image...', 'info');
      // Use proxy endpoint to bypass any cross-origin blocks
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
      let response = await fetch(proxyUrl).catch(() => null);

      if (!response || !response.ok) {
        response = await fetch(url);
      }

      const blob = await response.blob();
      const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
      handleSelectFile(file);
    } catch (err: any) {
      console.warn('Direct fetch failed, loading via canvas image:', err);
      // Fallback via Image object
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], name, { type: 'image/jpeg' });
              handleSelectFile(file);
            }
          }, 'image/jpeg', 0.9);
        }
      };
      img.onerror = () => {
        showNotification('Could not load sample image. Please upload a photo from your device.', 'error');
      };
      img.src = url;
    }
  };

  const handleCameraCapture = (blob: Blob, dataUrl: string) => {
    const name = `camera_shot_${Date.now()}.jpg`;
    const file = new File([blob], name, { type: 'image/jpeg' });
    setSourceFile(file);
    setSourceUrl(dataUrl);
    setFileName(name);
    setFileSize(blob.size);
    setResultUrl(null);
    setState('ready');
  };

  const handleRemoveBackground = async () => {
    if (!sourceFile && !sourceUrl) return;
    setState('processing');

    try {
      const resultBlob = await removeBackgroundServer(sourceUrl || sourceFile!);
      const outputUrl = URL.createObjectURL(resultBlob);
      setResultUrl(outputUrl);
      setState('done');
      showNotification('Background cut out cleanly!', 'success');
    } catch (err: any) {
      console.warn('Server removal attempt error:', err);
      setState('ready');
      showNotification('Could not process background removal. Please try another image.', 'error');
    }
  };

  const handleSaveResult = async () => {
    if (!resultUrl) return;
    try {
      await exportImage(resultUrl, selectedBg, customColor, fileName || 'clearcut');
      showNotification('Transparent image saved to downloads!', 'success');
    } catch (err: any) {
      console.error('Save error:', err);
      showNotification(err?.message || 'Could not save the image. Please try again.', 'error');
    }
  };

  const handleStartOver = () => {
    if (resultUrl && resultUrl.startsWith('blob:')) {
      URL.revokeObjectURL(resultUrl);
    }
    setSourceFile(null);
    setSourceUrl(null);
    setResultUrl(null);
    setFileName('');
    setFileSize(0);
    setState('empty');
  };

  return (
    <div className="min-h-screen bg-[#F3F7F5] flex flex-col items-center justify-start p-4 sm:p-6 md:p-8">
      {/* Toast Notification */}
      {notification && (
        <div
          id="toast-notification"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full shadow-lg text-sm font-semibold flex items-center gap-2 transition-all animate-bounce duration-300 ${
            notification.type === 'error'
              ? 'bg-[#10231F] text-red-300 border border-red-800/50'
              : notification.type === 'success'
              ? 'bg-[#176B51] text-white border border-[#278D6D]'
              : 'bg-[#10231F] text-white'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-400" />
          ) : notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#5EE0B5]" />
          ) : (
            <Sparkles className="w-4 h-4 text-[#5EE0B5]" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Main App Container (Centered responsive single view matching Flutter layout) */}
      <main className="w-full max-w-lg flex flex-col gap-6">
        {/* Header */}
        <Header onReset={handleStartOver} showReset={state !== 'empty' || appMode === 'batch'} />

        {/* Hero Title Section */}
        <section className="flex flex-col">
          <div className="flex justify-between items-start">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#10231F] leading-[1.08]">
              {appMode === 'batch' ? (
                <>
                  Batch processing<br />made easy.
                </>
              ) : state === 'done' ? (
                <>
                  Your clean cut<br />is ready.
                </>
              ) : (
                <>
                  Remove any<br />background.
                </>
              )}
            </h2>
            
            {/* Mode Toggle */}
            {state === 'empty' && (
              <button
                onClick={() => setAppMode(m => m === 'single' ? 'batch' : 'single')}
                className="px-3 py-1.5 bg-[#10231F] hover:bg-[#17332D] text-white text-xs font-bold rounded-full transition-colors shadow-sm"
              >
                {appMode === 'single' ? 'Batch Mode' : 'Single Mode'}
              </button>
            )}
          </div>
          <p className="mt-2 text-sm sm:text-base text-gray-600 font-medium">
            {appMode === 'batch'
              ? 'Upload multiple photos and process them sequentially.'
              : state === 'done'
              ? 'Transparent PNG, ready for your next idea.'
              : 'Pick a photo. ClearCut handles the rest.'}
          </p>
        </section>

        {/* Interactive Preview Card Stage */}
        <div className="relative w-full min-h-[520px] sm:min-h-[600px] flex flex-col">
          {appMode === 'batch' ? (
            <BatchProcessor
              onClose={() => setAppMode('single')}
              selectedBg={selectedBg}
              customColor={customColor}
            />
          ) : (
            <PreviewCard
              state={state}
              sourceUrl={sourceUrl}
              resultUrl={resultUrl}
              fileName={fileName}
              fileSize={fileSize}
              onSelectFile={handleSelectFile}
              onSelectSample={handleSelectSample}
              onOpenCamera={() => setIsCameraOpen(true)}
              selectedBg={selectedBg}
              customColor={customColor}
              isCropping={isCropping}
              onCropStart={() => setIsCropping(true)}
              onCropCancel={() => setIsCropping(false)}
              onCropApply={handleCropApply}
            />
          )}
        </div>

        {/* Background Color Controls (when cutout is ready or in batch mode) */}
        {(state === 'done' || appMode === 'batch') && (
          <BackgroundCustomizer
            selectedBg={selectedBg}
            onSelectBg={setSelectedBg}
            customColor={customColor}
            onCustomColorChange={setCustomColor}
          />
        )}

        {/* Action Controls */}
        <div className="flex flex-col gap-3">
          {state === 'ready' && (
            <button
              id="btn-remove-background"
              onClick={handleRemoveBackground}
              className="w-full py-4 px-6 bg-[#10231F] hover:bg-[#17332D] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg transition-all hover:scale-101 active:scale-98 cursor-pointer"
            >
              <Sparkles className="w-5 h-5 text-[#5EE0B5]" />
              <span>Remove background</span>
            </button>
          )}

          {state === 'processing' && (
            <button
              id="btn-processing-state"
              disabled
              className="w-full py-4 px-6 bg-[#10231F]/80 text-[#5EE0B5] font-extrabold text-base rounded-2xl flex items-center justify-center gap-3 shadow-md cursor-not-allowed opacity-95"
            >
              <div className="w-5 h-5 border-2 border-[#5EE0B5]/30 border-t-[#5EE0B5] rounded-full animate-spin" />
              <span>Processing your image…</span>
            </button>
          )}

          {state === 'done' && (
            <div className="flex flex-col gap-2.5">
              <button
                id="btn-save-result"
                onClick={handleSaveResult}
                className="w-full py-4 px-6 bg-[#10231F] hover:bg-[#17332D] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg transition-all hover:scale-101 active:scale-98 cursor-pointer"
              >
                <Download className="w-5 h-5 text-[#5EE0B5]" />
                <span>
                  {selectedBg.type === 'transparent'
                    ? 'Save transparent PNG'
                    : `Save with ${selectedBg.name}`}
                </span>
              </button>

              <button
                id="btn-start-over"
                onClick={handleStartOver}
                className="w-full py-2.5 text-sm font-bold text-[#10231F]/75 hover:text-[#10231F] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 text-[#397363]" />
                <span>Start with another photo</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature Badges (when empty) */}
        {state === 'empty' && <FeatureStrip />}
      </main>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </div>
  );
};

