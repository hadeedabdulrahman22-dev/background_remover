import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X, Grid3x3, RotateCcw } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onApply: (cropRect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

type AspectPreset = {
  id: string;
  label: string;
  value: number | undefined;
};

const ASPECT_PRESETS: AspectPreset[] = [
  { id: 'free', label: 'Free', value: undefined },
  { id: '1:1', label: '1:1 Square', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
  { id: '3:2', label: '3:2', value: 3 / 2 },
  { id: '9:16', label: '9:16 Story', value: 9 / 16 },
];

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageUrl, onApply, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [selectedAspectId, setSelectedAspectId] = useState<string>('free');
  const imgRef = useRef<HTMLImageElement>(null);

  // Initialize a default centered crop once the image loads
  const initCrop = (img: HTMLImageElement, aspectVal?: number) => {
    const { width, height } = img;
    let cropWidth = width * 0.88;
    let cropHeight = height * 0.88;

    if (aspectVal) {
      if (cropWidth / aspectVal <= height * 0.88) {
        cropHeight = cropWidth / aspectVal;
      } else {
        cropHeight = height * 0.88;
        cropWidth = cropHeight * aspectVal;
      }
    }

    const x = Math.max(0, (width - cropWidth) / 2);
    const y = Math.max(0, (height - cropHeight) / 2);

    const newCrop: PixelCrop = {
      unit: 'px',
      x,
      y,
      width: cropWidth,
      height: cropHeight,
    };
    setCrop(newCrop);
    setCompletedCrop(newCrop);
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    initCrop(e.currentTarget, undefined);
  };

  const handleSelectAspect = (preset: AspectPreset) => {
    setSelectedAspectId(preset.id);
    if (!imgRef.current) return;

    if (preset.value === undefined) {
      // Unconstrained
      return;
    }

    const { width, height } = imgRef.current;
    let newWidth = width * 0.85;
    let newHeight = newWidth / preset.value;

    if (newHeight > height * 0.85) {
      newHeight = height * 0.85;
      newWidth = newHeight * preset.value;
    }

    const x = Math.max(0, (width - newWidth) / 2);
    const y = Math.max(0, (height - newHeight) / 2);

    const newCrop: PixelCrop = {
      unit: 'px',
      x,
      y,
      width: newWidth,
      height: newHeight,
    };
    setCrop(newCrop);
    setCompletedCrop(newCrop);
  };

  const handleResetCrop = () => {
    if (imgRef.current) {
      const preset = ASPECT_PRESETS.find((p) => p.id === selectedAspectId);
      initCrop(imgRef.current, preset?.value);
    }
  };

  const handleApply = () => {
    if (!completedCrop || !imgRef.current) {
      onCancel();
      return;
    }

    if (completedCrop.width === 0 || completedCrop.height === 0) {
      onCancel();
      return;
    }

    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    onApply({
      x: Math.round(completedCrop.x * scaleX),
      y: Math.round(completedCrop.y * scaleY),
      width: Math.round(completedCrop.width * scaleX),
      height: Math.round(completedCrop.height * scaleY),
    });
  };

  const currentAspect = ASPECT_PRESETS.find((p) => p.id === selectedAspectId)?.value;

  // Calculate pixel size of the crop output in original image resolution
  let outputDimensions = '';
  if (completedCrop && imgRef.current && imgRef.current.width > 0) {
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
    const pxW = Math.round(completedCrop.width * scaleX);
    const pxH = Math.round(completedCrop.height * scaleY);
    if (pxW > 0 && pxH > 0) {
      outputDimensions = `${pxW} × ${pxH} px`;
    }
  }

  return (
    <div className="absolute inset-0 z-40 bg-[#0A1714] flex flex-col animate-in fade-in duration-200 select-none">
      {/* Top Header & Rule of Thirds Control Bar */}
      <div className="bg-[#10231F] border-b border-[#27483E] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          {/* Rule of Thirds Grid Toggle Button */}
          <button
            type="button"
            id="btn-crop-grid-toggle"
            onClick={() => setShowGrid(!showGrid)}
            title={showGrid ? 'Hide Rule of Thirds Grid' : 'Show Rule of Thirds Grid'}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              showGrid
                ? 'bg-[#5EE0B5] text-[#10231F] shadow-[0_0_12px_rgba(94,224,181,0.3)]'
                : 'bg-white/10 hover:bg-white/15 text-white/80 hover:text-white'
            }`}
          >
            <Grid3x3 className="w-3.5 h-3.5" />
            <span>Rule of Thirds Grid</span>
            <span
              className={`text-[10px] px-1 py-0.2 rounded font-extrabold ${
                showGrid ? 'bg-[#10231F]/20 text-[#10231F]' : 'bg-black/30 text-white/60'
              }`}
            >
              {showGrid ? 'ON' : 'OFF'}
            </span>
          </button>

          {/* Reset Crop Button */}
          <button
            type="button"
            id="btn-crop-reset"
            onClick={handleResetCrop}
            title="Reset crop frame to image size"
            className="px-2 py-1.5 rounded-lg text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>

        {/* Aspect Ratio Presets */}
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 no-scrollbar">
          {ASPECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectAspect(preset)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedAspectId === preset.id
                  ? 'bg-white/20 text-[#5EE0B5] font-bold border border-[#5EE0B5]/40 shadow-xs'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Cropping Viewport */}
      <div className="flex-1 overflow-hidden relative flex items-center justify-center p-3 md:p-6 bg-[#081210]">
        <ReactCrop
          crop={crop}
          aspect={currentAspect}
          ruleOfThirds={showGrid}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          className="max-h-full max-w-full"
          renderSelectionAddon={() =>
            showGrid ? (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden select-none"
                aria-hidden="true"
              >
                {/* Enhanced High-Contrast Rule of Thirds Grid Lines */}
                {/* Vertical 1/3 Line */}
                <div
                  className="absolute top-0 bottom-0 left-[33.333%] w-[1px] bg-white/80 shadow-[0_0_2px_rgba(0,0,0,0.85)]"
                  style={{ backdropFilter: 'contrast(1.2)' }}
                />
                {/* Vertical 2/3 Line */}
                <div
                  className="absolute top-0 bottom-0 left-[66.666%] w-[1px] bg-white/80 shadow-[0_0_2px_rgba(0,0,0,0.85)]"
                  style={{ backdropFilter: 'contrast(1.2)' }}
                />
                {/* Horizontal 1/3 Line */}
                <div
                  className="absolute left-0 right-0 top-[33.333%] h-[1px] bg-white/80 shadow-[0_0_2px_rgba(0,0,0,0.85)]"
                  style={{ backdropFilter: 'contrast(1.2)' }}
                />
                {/* Horizontal 2/3 Line */}
                <div
                  className="absolute left-0 right-0 top-[66.666%] h-[1px] bg-white/80 shadow-[0_0_2px_rgba(0,0,0,0.85)]"
                  style={{ backdropFilter: 'contrast(1.2)' }}
                />

                {/* 4 Intersection Power Points / Golden Focus Nodes */}
                {/* Top-Left intersection */}
                <div className="absolute top-[33.333%] left-[33.333%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-white bg-[#5EE0B5] shadow-[0_0_4px_rgba(0,0,0,0.9)] opacity-90 animate-pulse" />
                </div>
                {/* Top-Right intersection */}
                <div className="absolute top-[33.333%] left-[66.666%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-white bg-[#5EE0B5] shadow-[0_0_4px_rgba(0,0,0,0.9)] opacity-90 animate-pulse" />
                </div>
                {/* Bottom-Left intersection */}
                <div className="absolute top-[66.666%] left-[33.333%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-white bg-[#5EE0B5] shadow-[0_0_4px_rgba(0,0,0,0.9)] opacity-90 animate-pulse" />
                </div>
                {/* Bottom-Right intersection */}
                <div className="absolute top-[66.666%] left-[66.666%] -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 rounded-full border border-white bg-[#5EE0B5] shadow-[0_0_4px_rgba(0,0,0,0.9)] opacity-90 animate-pulse" />
                </div>
              </div>
            ) : null
          }
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop target"
            onLoad={onImageLoad}
            className="max-h-[260px] md:max-h-[320px] object-contain rounded-sm"
          />
        </ReactCrop>
      </div>

      {/* Footer Info & Action Bar */}
      <div className="h-14 bg-[#10231F] border-t border-[#27483E] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-crop-cancel"
            onClick={onCancel}
            className="text-white/80 hover:text-white px-3 py-1.5 flex items-center gap-1.5 text-sm font-bold transition-colors rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" /> Cancel
          </button>

          {outputDimensions && (
            <span className="hidden sm:inline-flex items-center text-xs font-medium text-emerald-300/80 bg-black/40 px-2.5 py-1 rounded-md border border-white/5">
              {outputDimensions}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {showGrid && (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-white/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5EE0B5]" />
              Align subjects to grid intersections
            </span>
          )}

          <button
            type="button"
            id="btn-crop-apply"
            onClick={handleApply}
            className="bg-[#5EE0B5] hover:bg-[#4dd0a5] text-[#10231F] px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-extrabold transition-all shadow-[0_2px_8px_rgba(94,224,181,0.25)] active:scale-97 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
};
