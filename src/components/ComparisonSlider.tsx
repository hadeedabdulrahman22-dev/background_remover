import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ChevronsLeftRight } from 'lucide-react';

interface ComparisonSliderProps {
  originalSrc: string;
  resultSrc: string;
  className?: string;
  backgroundStyle?: React.CSSProperties;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalSrc,
  resultSrc,
  className = '',
  backgroundStyle = {},
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
      className={`relative select-none overflow-hidden cursor-ew-resize w-full h-full flex items-center justify-center ${className}`}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        handleMove(e.touches[0].clientX);
      }}
    >
      {/* Background (Clean Result with Custom / Checkerboard BG) */}
      <div 
        className="absolute inset-0 w-full h-full flex items-center justify-center bg-checkerboard"
        style={backgroundStyle}
      >
        <img
          src={resultSrc}
          alt="Transparent cutout result"
          className="w-full h-full object-contain pointer-events-none"
        />
        <div className="absolute top-3 right-3 px-2.5 py-1 bg-[#10231F]/70 backdrop-blur-xs text-[#5EE0B5] text-xs font-semibold rounded-md pointer-events-none shadow-xs">
          Clean Cut
        </div>
      </div>

      {/* Foreground (Original image clipped to slider position) */}
      <div
        className="absolute inset-0 h-full overflow-hidden flex items-center justify-center pointer-events-none"
        style={{ width: `${sliderPosition}%` }}
      >
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ width: containerRef.current ? `${containerRef.current.clientWidth}px` : '100%' }}
        >
          <img
            src={originalSrc}
            alt="Original uploaded source"
            className="w-full h-full object-contain pointer-events-none"
          />
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#10231F]/70 backdrop-blur-xs text-white text-xs font-semibold rounded-md pointer-events-none shadow-xs">
            Original
          </div>
        </div>
      </div>

      {/* Slider Divider Line & Thumb */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] z-20 pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#10231F] text-[#5EE0B5] border-2 border-white shadow-lg flex items-center justify-center">
          <ChevronsLeftRight className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
};
