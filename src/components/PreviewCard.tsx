import React, { useRef, useState, useEffect } from 'react';
import { WorkState, BackgroundOption, ImageFilter } from '../types';
import { getCssFilterString } from '../utils/imageUtils';
import { ComparisonSlider } from './ComparisonSlider';
import { SampleImages } from './SampleImages';
import { ImageCropper } from './ImageCropper';
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  RefreshCw, 
  SlidersHorizontal, 
  Eye, 
  Sparkles,
  Copy,
  Check,
  ZoomIn,
  Crop,
  RotateCw,
  Clock,
  Eraser,
  Scissors,
  Magnet
} from 'lucide-react';

interface PreviewCardProps {
  state: WorkState;
  sourceUrl: string | null;
  resultUrl: string | null;
  fileName?: string;
  fileSize?: number;
  onSelectFile: (file: File) => void;
  onSelectSample: (url: string, name: string) => void;
  onOpenCamera: () => void;
  selectedBg: BackgroundOption;
  customColor: string;
  bgFilter?: ImageFilter;
  cutoutFilter?: ImageFilter;
  isCropping: boolean;
  onCropStart: () => void;
  onCropCancel: () => void;
  onCropApply: (cropRect: { x: number; y: number; width: number; height: number }) => void;
  onRotate?: () => void;
  onRefineCutout?: () => void;
}

export const PreviewCard: React.FC<PreviewCardProps> = ({
  state,
  sourceUrl,
  resultUrl,
  fileName,
  fileSize,
  onSelectFile,
  onSelectSample,
  onOpenCamera,
  selectedBg,
  customColor,
  bgFilter = 'none',
  cutoutFilter = 'none',
  isCropping,
  onCropStart,
  onCropCancel,
  onCropApply,
  onRotate,
  onRefineCutout,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'cutout' | 'original' | 'compare'>('cutout');
  const [copied, setCopied] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state !== 'processing') {
      setElapsedSec(0);
      return;
    }
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsedSec(Math.round((Date.now() - start) / 100) / 10);
    }, 100);
    return () => clearInterval(interval);
  }, [state]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onSelectFile(e.target.files[0]);
    }
  };

  const handleCopyImage = async () => {
    if (!resultUrl) return;
    try {
      const response = await fetch(resultUrl);
      const blob = await response.blob();
      const pngBlob = blob.type === 'image/png' ? blob : new Blob([blob], { type: 'image/png' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': pngBlob,
        }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Could not copy image to clipboard:', err);
    }
  };

  const getBackgroundStyle = (): React.CSSProperties => {
    if (selectedBg.type === 'transparent') {
      return {};
    }
    if (selectedBg.id === 'custom') {
      return { backgroundColor: customColor };
    }
    if (selectedBg.type === 'gradient') {
      return { background: selectedBg.value };
    }
    return { backgroundColor: selectedBg.value };
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      id="preview-card-stage"
      className={`relative w-full flex-1 rounded-[32px] bg-white border border-[#DDE7E2] shadow-[0_12px_30px_rgba(13,43,35,0.07)] overflow-hidden transition-all flex flex-col items-center justify-center ${
        isDragOver ? 'border-[#5EE0B5] ring-4 ring-[#5EE0B5]/20 bg-[#F0FDF8]' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {isCropping && (sourceUrl || resultUrl) && (
        <ImageCropper
          imageUrl={(state === 'done' && resultUrl) ? resultUrl : sourceUrl!}
          onApply={onCropApply}
          onCancel={onCropCancel}
        />
      )}

      {/* STATE: EMPTY */}
      {state === 'empty' && (
        <div className="w-full h-full p-6 md:p-8 flex flex-col justify-between items-center text-center">
          <div className="flex-1 flex flex-col items-center justify-center max-w-sm">
            <div className="w-16 h-16 md:w-18 md:h-18 rounded-full bg-[#E2FAF1] text-[#176B51] flex items-center justify-center mb-4 transition-transform hover:scale-105">
              <Upload className="w-8 h-8 text-[#176B51]" />
            </div>

            <h3 className="text-xl md:text-2xl font-extrabold text-[#10231F] mb-1">
              Choose your image
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              JPG, PNG or WEBP · Drag & drop or browse
            </p>

            <div className="flex items-center gap-3 w-full">
              <button
                id="btn-upload-gallery"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 px-4 bg-[#10231F] hover:bg-[#17332D] text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md transition-all active:scale-98"
              >
                <ImageIcon className="w-4 h-4 text-[#5EE0B5]" />
                <span>Upload</span>
              </button>

              <button
                id="btn-open-camera"
                onClick={onOpenCamera}
                className="flex-1 py-3 px-4 bg-white hover:bg-[#F3F7F5] border border-[#DDE7E2] text-[#10231F] font-bold rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all active:scale-98"
              >
                <Camera className="w-4 h-4 text-[#397363]" />
                <span>Camera</span>
              </button>
            </div>
          </div>

          <div className="w-full">
            <SampleImages onSelectSample={onSelectSample} />
          </div>
        </div>
      )}

      {/* STATE: READY */}
      {state === 'ready' && sourceUrl && (
        <div className="relative w-full h-full flex items-center justify-center bg-[#F7FAF8] p-4">
          <img
            src={sourceUrl}
            alt="Source preview"
            className="w-full h-full object-contain max-h-[380px]"
          />

          {/* Top Controls Overlay */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            {fileName && (
              <div className="px-3 py-1.5 bg-[#10231F]/75 backdrop-blur-xs text-white text-xs font-semibold rounded-lg shadow-sm truncate max-w-[200px]">
                {fileName} {fileSize ? `(${formatFileSize(fileSize)})` : ''}
              </div>
            )}
            <div className="ml-auto pointer-events-auto flex items-center gap-1.5">
              {onRefineCutout && (
                <button
                  id="btn-ready-touchup"
                  onClick={onRefineCutout}
                  title="Draw cutout line beside object - snaps automatically to edge"
                  className="p-2.5 bg-white/90 hover:bg-white text-[#10231F] rounded-full shadow-md border border-[#DDE7E2] transition-all hover:scale-105 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <Magnet className="w-3.5 h-3.5 text-[#176B51]" />
                  <span className="hidden sm:inline">Smart Snap Cut</span>
                </button>
              )}
              {onRotate && (
                <button
                  id="btn-rotate-image"
                  onClick={onRotate}
                  title="Rotate 90 degrees"
                  className="p-2.5 bg-white/90 hover:bg-white text-[#10231F] rounded-full shadow-md border border-[#DDE7E2] transition-all hover:scale-105 flex items-center justify-center cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              )}
              <button
                id="btn-crop-image"
                onClick={onCropStart}
                title="Crop image with Rule of Thirds alignment grid"
                className="p-2.5 bg-white/90 hover:bg-white text-[#10231F] rounded-full shadow-md border border-[#DDE7E2] transition-all hover:scale-105 flex items-center justify-center cursor-pointer"
              >
                <Crop className="w-4 h-4" />
              </button>
              <button
                id="btn-change-image"
                onClick={() => fileInputRef.current?.click()}
                title="Choose another image"
                className="p-2.5 bg-white/90 hover:bg-white text-[#10231F] rounded-full shadow-md border border-[#DDE7E2] transition-all hover:scale-105 flex items-center gap-1.5 text-xs font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATE: PROCESSING */}
      {state === 'processing' && sourceUrl && (
        <div className="relative w-full h-full flex items-center justify-center bg-[#0B1F1A] overflow-hidden">
          <img
            src={sourceUrl}
            alt="Processing cutout"
            className="w-full h-full object-contain opacity-30 blur-[2px] transition-all"
          />

          {/* Animated Laser Scanning Line */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#5EE0B5] to-transparent shadow-[0_0_15px_#5EE0B5] animate-pulse absolute top-0 left-0 transition-all duration-1000"
              style={{
                top: `${(Math.sin(elapsedSec * 2) * 0.5 + 0.5) * 85 + 5}%`,
              }}
            />
          </div>

          <div className="absolute inset-0 bg-[#0B1F1A]/75 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-6 z-20">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div className="w-16 h-16 border-4 border-[#5EE0B5]/20 border-t-[#5EE0B5] rounded-full animate-spin" />
              <Sparkles className="w-7 h-7 text-[#5EE0B5] absolute animate-pulse" />
            </div>

            <h4 className="text-white font-extrabold text-lg md:text-xl tracking-tight mb-1">
              {elapsedSec < 1.5 && 'Pre-processing & optimizing image…'}
              {elapsedSec >= 1.5 && elapsedSec < 5.0 && 'AI neural network detecting subject…'}
              {elapsedSec >= 5.0 && elapsedSec < 8.5 && 'Refining hair strands & edge transparency…'}
              {elapsedSec >= 8.5 && 'Finalizing transparent cutout…'}
            </h4>

            <p className="text-[#A3C8BD] text-xs md:text-sm max-w-xs mb-4">
              {elapsedSec < 1.5 && 'Preparing resolution profile for maximum clarity'}
              {elapsedSec >= 1.5 && elapsedSec < 5.0 && 'Segmenting person, pet, or object from background'}
              {elapsedSec >= 5.0 && elapsedSec < 8.5 && 'Generating high-fidelity sub-pixel alpha mask'}
              {elapsedSec >= 8.5 && 'Assembling ultra-clean PNG result'}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-xs bg-[#17382F] rounded-full h-2 overflow-hidden mb-3 border border-[#275346]">
              <div
                className="bg-gradient-to-r from-[#176B51] to-[#5EE0B5] h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${Math.min(96, Math.max(15, Math.round(elapsedSec < 1.5 ? 25 : elapsedSec < 5.0 ? 30 + (elapsedSec - 1.5) * 12 : elapsedSec < 8.5 ? 72 + (elapsedSec - 5.0) * 6 : 94)))}%`
                }}
              />
            </div>

            {/* Live Timer Pill */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#10231F]/90 border border-[#27483E] text-[#5EE0B5] text-xs font-mono font-semibold shadow-xs">
                <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>{elapsedSec.toFixed(1)}s elapsed</span>
              </div>
            </div>

            <p className="text-gray-400 text-[11px] mt-3">
              ⚡ Instant cached results on subsequent edits and sample demo photos.
            </p>
          </div>
        </div>
      )}

      {/* STATE: DONE */}
      {state === 'done' && resultUrl && sourceUrl && (
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          {viewMode === 'compare' ? (
            <ComparisonSlider
              originalSrc={sourceUrl}
              resultSrc={resultUrl}
              backgroundStyle={getBackgroundStyle()}
              bgFilter={bgFilter}
              cutoutFilter={cutoutFilter}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center p-4 relative"
            >
              {viewMode === 'cutout' && (
                <div 
                  className={`absolute inset-0 z-0 ${selectedBg.type === 'transparent' ? 'bg-checkerboard' : ''}`}
                  style={{ ...getBackgroundStyle(), filter: getCssFilterString(bgFilter) }}
                />
              )}
              <img
                src={viewMode === 'cutout' ? resultUrl : sourceUrl}
                alt={viewMode === 'cutout' ? "Clean Cut Result (After)" : "Original Image (Before)"}
                className="w-full h-full object-contain transition-all relative z-10 max-h-[380px]"
                style={{ filter: viewMode === 'cutout' ? getCssFilterString(cutoutFilter) : 'none' }}
              />

              {/* Status Badge & Touch-Up Shortcut */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 bg-[#10231F]/80 backdrop-blur-xs text-white text-xs font-semibold rounded-full shadow-md border border-white/10 flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${viewMode === 'cutout' ? 'bg-[#5EE0B5]' : 'bg-amber-400'}`} />
                  <span>Viewing: <strong>{viewMode === 'cutout' ? 'After (Cutout)' : 'Before (Original)'}</strong></span>
                </span>

                {onRefineCutout && (
                  <button
                    id="btn-card-touchup-bottom"
                    onClick={onRefineCutout}
                    title="Draw line beside object - snaps automatically to edge and clears leftovers"
                    className="pointer-events-auto px-3 py-1 bg-[#10231F]/90 hover:bg-[#17382F] text-white text-xs font-bold rounded-full shadow-lg border border-[#27483E] flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer"
                  >
                    <Magnet className="w-3.5 h-3.5 text-[#5EE0B5]" />
                    <span>Auto-Snap Cutout</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Top Bar for Done State */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-30">
            {/* View Mode Toggle: Before / After / Split Slider */}
            <div className="pointer-events-auto flex items-center bg-[#10231F]/90 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-[#27483E] divide-x divide-white/10">
              <div className="flex items-center gap-1 pr-1">
                <button
                  id="btn-toggle-original"
                  onClick={() => setViewMode('original')}
                  title="View original image (Before)"
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    viewMode === 'original'
                      ? 'bg-white text-[#10231F] shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Before</span>
                </button>
                <button
                  id="btn-toggle-cutout"
                  onClick={() => setViewMode('cutout')}
                  title="View cutout result (After)"
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    viewMode === 'cutout'
                      ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>After</span>
                </button>
              </div>

              <div className="pl-1">
                <button
                  id="btn-toggle-compare"
                  onClick={() => setViewMode('compare')}
                  title="Compare with interactive Before/After slider"
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                    viewMode === 'compare'
                      ? 'bg-[#5EE0B5] text-[#10231F] shadow-sm'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Slider</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              {onRefineCutout && (
                <button
                  id="btn-touchup-result"
                  onClick={onRefineCutout}
                  title="Draw line beside object to snap & clear leftover background"
                  className="p-2 bg-[#5EE0B5] hover:bg-[#4DD0A5] text-[#10231F] rounded-xl shadow-md border border-[#3EBF97] transition-all hover:scale-105 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Magnet className="w-4 h-4" />
                  <span className="hidden sm:inline">Smart Snap Cut</span>
                </button>
              )}
              {onRotate && (
                <button
                  id="btn-rotate-result"
                  onClick={onRotate}
                  title="Rotate 90 degrees"
                  className="p-2 bg-white/90 hover:bg-white text-[#10231F] rounded-xl shadow-md border border-[#DDE7E2] transition-all hover:scale-105 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="hidden sm:inline">Rotate</span>
                </button>
              )}
              <button
                id="btn-crop-result"
                onClick={onCropStart}
                title="Crop image with Rule of Thirds alignment grid"
                className="p-2 bg-white/90 hover:bg-white text-[#10231F] rounded-xl shadow-md border border-[#DDE7E2] transition-all hover:scale-105 text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Crop className="w-4 h-4" />
                <span className="hidden sm:inline">Crop</span>
              </button>
              <button
                id="btn-copy-clipboard"
                onClick={handleCopyImage}
                title="Copy to clipboard"
                className="p-2 bg-white/90 hover:bg-white text-[#10231F] rounded-xl shadow-md border border-[#DDE7E2] transition-all hover:scale-105 text-xs font-bold flex items-center gap-1"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
