import React, { useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageUrl: string;
  onApply: (cropRect: { x: number; y: number; width: number; height: number }) => void;
  onCancel: () => void;
}

export const ImageCropper: React.FC<ImageCropperProps> = ({ imageUrl, onApply, onCancel }) => {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);

  // Initialize a default centered crop once the image loads
  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height) * 0.9;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    setCrop({
      unit: 'px',
      x,
      y,
      width: size,
      height: size,
    });
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
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    });
  };

  return (
    <div className="absolute inset-0 z-40 bg-[#0A1714] flex flex-col animate-in fade-in duration-200">
      <div className="flex-1 overflow-hidden flex items-center justify-center p-4">
        <ReactCrop
          crop={crop}
          onChange={(_, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          className="max-h-full max-w-full"
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop target"
            onLoad={onImageLoad}
            className="max-h-[260px] md:max-h-[300px] object-contain"
          />
        </ReactCrop>
      </div>
      <div className="h-14 bg-[#10231F] border-t border-[#27483E] flex items-center justify-between px-4 shrink-0">
        <button onClick={onCancel} className="text-white/80 hover:text-white px-3 py-1.5 flex items-center gap-1.5 text-sm font-bold transition-colors rounded-lg hover:bg-white/10">
          <X className="w-4 h-4" /> Cancel
        </button>
        <button onClick={handleApply} className="bg-[#5EE0B5] text-[#10231F] px-4 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-bold hover:bg-[#4dd0a5] transition-colors shadow-sm">
          <Check className="w-4 h-4" /> Apply
        </button>
      </div>
    </div>
  );
};
