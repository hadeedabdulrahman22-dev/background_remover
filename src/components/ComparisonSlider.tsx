import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';
import { ImageFilter } from '../types';
import { getCssFilterString } from '../utils/imageUtils';

interface ComparisonSliderProps {
  originalSrc: string;
  resultSrc: string;
  className?: string;
  backgroundStyle?: React.CSSProperties;
  bgFilter?: ImageFilter;
  cutoutFilter?: ImageFilter;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalSrc,
  resultSrc,
  className = '',
  backgroundStyle = {},
  bgFilter = 'none',
  cutoutFilter = 'none',
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      handleMove(e.touches[0].clientX);
    },
    [isDragging, handleMove]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      handleMove(e.clientX);
    },
    [isDragging, handleMove]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  return (
    <div
      id="comparison-slider-container"
      ref={containerRef}
      className={`relative select-none overflow-hidden cursor-ew-resize w-full h-full flex items-center justify-center group ${className}`}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* Background (After / Processed Cut-out with Background & Filters) */}
      <div 
        className="absolute inset-0 w-full h-full flex items-center justify-center bg-checkerboard"
        style={{ ...backgroundStyle, filter: getCssFilterString(bgFilter) }}
      />
      <div className="absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none p-4">
        <img
          src={resultSrc}
          alt="Processed cut-out result (After)"
          className="w-full h-full object-contain pointer-events-none max-h-[380px]"
          style={{ filter: getCssFilterString(cutoutFilter) }}
        />
        <div className="absolute top-14 right-3 px-2.5 py-1 bg-[#10231F]/80 backdrop-blur-xs text-[#5EE0B5] text-xs font-bold rounded-lg pointer-events-none shadow-md border border-[#27483E]/50 flex items-center gap-1">
          <span>After (Cutout)</span>
        </div>
      </div>

      {/* Foreground (Before / Original image clipped to slider position) */}
      <div
        className="absolute inset-0 h-full overflow-hidden flex items-center justify-center pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center p-4"
          style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
        >
          <img
            src={originalSrc}
            alt="Original image (Before)"
            className="w-full h-full object-contain pointer-events-none max-h-[380px]"
          />
          <div className="absolute top-14 left-3 px-2.5 py-1 bg-[#10231F]/80 backdrop-blur-xs text-white text-xs font-bold rounded-lg pointer-events-none shadow-md border border-white/20 flex items-center gap-1">
            <span>Before (Original)</span>
          </div>
        </div>
      </div>

      {/* Slider Divider Line & Interactive Handle */}
      <div
        className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_12px_rgba(0,0,0,0.5)] z-20 pointer-events-none transition-shadow group-hover:shadow-[0_0_16px_rgba(94,224,181,0.7)]"
        style={{ left: `${sliderPosition}%` }}
      >
        <div 
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[#10231F] text-[#5EE0B5] border-2 border-white shadow-xl flex items-center justify-center transition-transform group-hover:scale-110 active:scale-95"
          role="slider"
          aria-label="Before/After comparison slider"
          aria-valuenow={Math.round(sliderPosition)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <ChevronsLeftRight className="w-5 h-5 stroke-[2.5]" />
        </div>
      </div>

      {/* Bottom Hint Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#10231F]/70 backdrop-blur-xs text-white/90 text-[11px] font-medium rounded-full pointer-events-none shadow-sm flex items-center gap-1.5 z-20">
        <ChevronsLeftRight className="w-3.5 h-3.5 text-[#5EE0B5]" />
        <span>Drag left or right to compare Before & After</span>
      </div>
    </div>
  );
};
