import React, { useRef, useState } from 'react';
import { WorkState, BackgroundOption } from '../types';
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
  Crop
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
  isCropping: boolean;
  onCropStart: () => void;
  onCropCancel: () => void;
  onCropApply: (cropRect: { x: number; y: number; width: number; height: number }) => void;
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
  isCropping,
  onCropStart,
  onCropCancel,
  onCropApply,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'cutout' | 'original' | 'compare'>('cutout');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
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
      className={`relative w-full h-[360px] md:h-[400px] rounded-3xl bg-white border border-[#DDE7E2] shadow-[0_12px_30px_rgba(13,43,35,0.07)] overflow-hidden transition-all flex flex-col items-center justify-center ${
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
            className="w-full h-full object-contain max-h-[340px]"
          />

          {/* Top Controls Overlay */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
            {fileName && (
              <div className="px-3 py-1.5 bg-[#10231F]/75 backdrop-blur-xs text-white text-xs font-semibold rounded-lg shadow-sm truncate max-w-[200px]">
                {fileName} {fileSize ? `(${formatFileSize(fileSize)})` : ''}
              </div>
            )}
            <div className="ml-auto pointer-events-auto flex items-center gap-1.5">
              <button
                id="btn-crop-image"
                onClick={onCropStart}
                title="Crop image"
                className="p-2.5 bg-white/90 hover:bg-white text-[#10231F] rounded-full shadow-md border border-[#DDE7E2] transition-all hover:scale-105 flex items-center justify-center"
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
        <div className="relative w-full h-full flex items-center justify-center bg-[#0B1F1A]">
          <img
            src={sourceUrl}
            alt="Processing cutout"
            className="w-full h-full object-contain opacity-40 blur-[1px]"
          />

          <div className="absolute inset-0 bg-[#0B1F1A]/70 flex flex-col items-center justify-center text-center p-6">
            <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
              <div className="w-14 h-14 border-4 border-[#5EE0B5]/20 border-t-[#5EE0B5] rounded-full animate-spin" />
              <Sparkles className="w-6 h-6 text-[#5EE0B5] absolute animate-pulse" />
            </div>
            <h4 className="text-white font-extrabold text-lg md:text-xl tracking-tight mb-1">
              Cutting out the subject…
            </h4>
            <p className="text-[#A3C8BD] text-xs md:text-sm">
              Applying AI neural edge segmentation
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
            />
          ) : (
            <div
              className={`w-full h-full flex items-center justify-center p-4 ${
                (viewMode === 'cutout' && selectedBg.type === 'transparent') ? 'bg-checkerboard' : ''
              }`}
              style={viewMode === 'cutout' ? getBackgroundStyle() : {}}
            >
              <img
                src={viewMode === 'cutout' ? resultUrl : sourceUrl}
                alt={viewMode === 'cutout' ? "Clean Cut Result" : "Original Image"}
                className="w-full h-full object-contain transition-all"
              />
            </div>
          )}

          {/* Top Bar for Done State */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-30">
            {/* View Mode Toggle */}
            <div className="pointer-events-auto flex items-center gap-1 bg-[#10231F]/80 backdrop-blur-xs p-1 rounded-xl shadow-md border border-[#27483E]">
              <button
                id="btn-toggle-original"
                onClick={() => setViewMode('original')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === 'original' ? 'bg-[#5EE0B5] text-[#10231F]' : 'text-white/80 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Original</span>
              </button>
              <button
                id="btn-toggle-cutout"
                onClick={() => setViewMode('cutout')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === 'cutout' ? 'bg-[#5EE0B5] text-[#10231F]' : 'text-white/80 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Cutout</span>
              </button>
              <button
                id="btn-toggle-compare"
                onClick={() => setViewMode('compare')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${
                  viewMode === 'compare' ? 'bg-[#5EE0B5] text-[#10231F]' : 'text-white/80 hover:text-white'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Split</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                id="btn-crop-result"
                onClick={onCropStart}
                title="Crop image"
                className="p-2 bg-white/90 hover:bg-white text-[#10231F] rounded-xl shadow-md border border-[#DDE7E2] transition-all hover:scale-105 text-xs font-bold flex items-center gap-1"
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
