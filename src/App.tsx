import React, { useState, useEffect } from 'react';
import { WorkState, BackgroundOption, AppMode, ImageFilter } from './types';
import { Header } from './components/Header';
import { PreviewCard } from './components/PreviewCard';
import { FeatureStrip } from './components/FeatureStrip';
import { BackgroundCustomizer, PRESET_BACKGROUNDS } from './components/BackgroundCustomizer';
import { FilterCustomizer } from './components/FilterCustomizer';
import { ResizeCustomizer } from './components/ResizeCustomizer';
import { ResizeOptions } from './types';
import { CameraCaptureModal } from './components/CameraCaptureModal';
import { CutoutRefinerModal } from './components/CutoutRefinerModal';
import { BatchProcessor } from './components/BatchProcessor';
import { exportImage, removeBackgroundClientSide, applyCropToImage, removeBackgroundServer, rotateImage } from './utils/imageUtils';
import { Sparkles, Download, RefreshCw, AlertCircle, CheckCircle2, Eraser, Scissors, Magnet } from 'lucide-react';

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
  const [bgFilter, setBgFilter] = useState<ImageFilter>('none');
  const [cutoutFilter, setCutoutFilter] = useState<ImageFilter>('none');
  const [resizeOptions, setResizeOptions] = useState<ResizeOptions>({
    mode: 'original',
    percentage: 100,
    width: 0,
    height: 0,
  });
  const [originalDimensions, setOriginalDimensions] = useState<{width: number, height: number} | undefined>(undefined);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const handleRefineApply = (refinedBlob: Blob) => {
    const newUrl = URL.createObjectURL(refinedBlob);
    setResultUrl(newUrl);
    setState('done');
    showNotification('Cutout refined! Leftover background removed.', 'success');
  };

  
  useEffect(() => {
    if (resultUrl) {
      const img = new Image();
      img.onload = () => {
        setOriginalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        setResizeOptions(prev => ({ ...prev, width: img.naturalWidth, height: img.naturalHeight }));
      };
      img.src = resultUrl;
    }
  }, [resultUrl]);

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
      console.warn('Crop image error:', err);
      setIsCropping(false);
      showNotification('Failed to crop image.', 'error');
    }
  };

  const handleRotate = async () => {
    try {
      showNotification('Rotating image...', 'info');
      let newSourceUrl = sourceUrl;
      let newResultUrl = resultUrl;
      let newSourceFile = sourceFile;

      if (sourceUrl) {
        const rotatedSourceBlob = await rotateImage(sourceUrl, 90);
        newSourceUrl = URL.createObjectURL(rotatedSourceBlob);
        if (sourceFile) {
          newSourceFile = new File([rotatedSourceBlob], sourceFile.name, { type: rotatedSourceBlob.type });
        } else {
          newSourceFile = new File([rotatedSourceBlob], fileName || 'rotated.png', { type: rotatedSourceBlob.type });
        }
      }

      if (resultUrl) {
        const rotatedResultBlob = await rotateImage(resultUrl, 90);
        newResultUrl = URL.createObjectURL(rotatedResultBlob);
      }

      setSourceUrl(newSourceUrl);
      setSourceFile(newSourceFile);
      if (newResultUrl) setResultUrl(newResultUrl);
      
    } catch (err: any) {
      console.warn('Rotate image error:', err);
      showNotification('Failed to rotate image.', 'error');
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
      let response: Response | null = null;
      if (url.startsWith('/') || !url.startsWith('http')) {
        response = await fetch(url);
      } else {
        const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`;
        response = await fetch(proxyUrl).catch(() => null);
        if (!response || !response.ok) {
          response = await fetch(url);
        }
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
      const resultBlob = await removeBackgroundServer(sourceFile || sourceUrl!, fileName || 'upload.png');
      const outputUrl = URL.createObjectURL(resultBlob);
      setResultUrl(outputUrl);
      setState('done');
      showNotification('Background cut out cleanly!', 'success');
    } catch (err: any) {
      console.warn('Background removal error:', err);
      setState('ready');
      showNotification(err?.message || 'Could not process background removal. Please try another image.', 'error');
    }
  };

  const handleSaveResult = async (format: 'png' | 'jpg' = 'png') => {
    if (!resultUrl) return;
    try {
      await exportImage(resultUrl, selectedBg, customColor, fileName || 'clearcut', format, bgFilter, cutoutFilter, resizeOptions);
      const formatLabel = format === 'jpg' ? 'JPG' : 'PNG';
      showNotification(`Image saved as ${formatLabel} to downloads!`, 'success');
    } catch (err: any) {
      console.warn('Save image error:', err);
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
              bgFilter={bgFilter}
              cutoutFilter={cutoutFilter}
              isCropping={isCropping}
              onCropStart={() => setIsCropping(true)}
              onCropCancel={() => setIsCropping(false)}
              onCropApply={handleCropApply}
              onRotate={handleRotate}
              onRefineCutout={() => setIsRefining(true)}
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
        {state === 'done' && (
          <>
            <FilterCustomizer bgFilter={bgFilter} setBgFilter={setBgFilter} cutoutFilter={cutoutFilter} setCutoutFilter={setCutoutFilter} />
            <ResizeCustomizer resizeOptions={resizeOptions} setResizeOptions={setResizeOptions} originalDimensions={originalDimensions} />
          </>
        )}

        {/* Action Controls */}
        <div className="flex flex-col gap-3">
          {state === 'ready' && (
            <div className="flex flex-col gap-2">
              <button
                id="btn-remove-background"
                onClick={handleRemoveBackground}
                className="w-full py-4 px-6 bg-[#10231F] hover:bg-[#17332D] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg transition-all hover:scale-101 active:scale-98 cursor-pointer"
              >
                <Sparkles className="w-5 h-5 text-[#5EE0B5]" />
                <span>Remove background</span>
              </button>
              <button
                id="btn-manual-cutout-ready"
                onClick={() => setIsRefining(true)}
                className="w-full py-3 px-4 bg-white hover:bg-[#F3F7F5] border border-[#CCDCD5] text-[#10231F] font-bold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-101 active:scale-98 cursor-pointer"
              >
                <Magnet className="w-4 h-4 text-[#176B51]" />
                <span>Smart Snap Cutout (Draw line to auto-snap to object)</span>
              </button>
            </div>
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
              {/* Smart Edge-Snap & Leftover Eraser Action */}
              <button
                id="btn-open-touchup"
                onClick={() => setIsRefining(true)}
                className="w-full py-3.5 px-4 bg-white hover:bg-[#F0F6F3] border-2 border-[#10231F] text-[#10231F] font-extrabold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-xs transition-all hover:scale-101 active:scale-98 cursor-pointer"
              >
                <Magnet className="w-4 h-4 text-[#176B51]" />
                <span>Smart Snap & Erase Leftovers (Draw line beside object to snap)</span>
              </button>

              {selectedBg.type === 'transparent' ? (
                <button
                  id="btn-save-result"
                  onClick={() => handleSaveResult('png')}
                  className="w-full py-4 px-6 bg-[#10231F] hover:bg-[#17332D] text-white font-extrabold text-base rounded-2xl flex items-center justify-center gap-2.5 shadow-lg transition-all hover:scale-101 active:scale-98 cursor-pointer"
                >
                  <Download className="w-5 h-5 text-[#5EE0B5]" />
                  <span>Save transparent PNG</span>
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    id="btn-save-result-png"
                    onClick={() => handleSaveResult('png')}
                    className="flex-1 py-3.5 px-4 bg-[#10231F] hover:bg-[#17332D] text-white font-extrabold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-101 active:scale-98 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#5EE0B5]" />
                    <span>Save PNG</span>
                  </button>
                  <button
                    id="btn-save-result-jpg"
                    onClick={() => handleSaveResult('jpg')}
                    className="flex-1 py-3.5 px-4 bg-white hover:bg-[#F3F7F5] border-2 border-[#10231F] text-[#10231F] font-extrabold text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all hover:scale-101 active:scale-98 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#10231F]" />
                    <span>Save JPG</span>
                  </button>
                </div>
              )}

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

      {/* Manual Cutout & Touch-Up Editor Modal */}
      <CutoutRefinerModal
        isOpen={isRefining}
        onClose={() => setIsRefining(false)}
        sourceUrl={sourceUrl || ''}
        resultUrl={resultUrl}
        onApply={handleRefineApply}
      />
    </div>
  );
};

