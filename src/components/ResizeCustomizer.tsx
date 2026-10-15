import React from 'react';
import { ResizeOptions } from '../types';
import { Maximize, Percent, Hash } from 'lucide-react';

interface ResizeCustomizerProps {
  resizeOptions: ResizeOptions;
  setResizeOptions: React.Dispatch<React.SetStateAction<ResizeOptions>>;
  originalDimensions?: { width: number; height: number };
}

export const ResizeCustomizer: React.FC<ResizeCustomizerProps> = ({
  resizeOptions,
  setResizeOptions,
  originalDimensions
}) => {
  const handleModeChange = (mode: ResizeOptions['mode']) => {
    setResizeOptions((prev) => ({ ...prev, mode }));
  };

  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    setResizeOptions((prev) => ({ ...prev, percentage: isNaN(val) ? 100 : val }));
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const width = isNaN(val) ? 0 : val;
    setResizeOptions((prev) => {
      let height = prev.height;
      if (originalDimensions) {
        const aspect = originalDimensions.height / originalDimensions.width;
        height = Math.round(width * aspect);
      }
      return { ...prev, width, height };
    });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    const height = isNaN(val) ? 0 : val;
    setResizeOptions((prev) => {
      let width = prev.width;
      if (originalDimensions) {
        const aspect = originalDimensions.width / originalDimensions.height;
        width = Math.round(height * aspect);
      }
      return { ...prev, width, height };
    });
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#DDE7E2]">
      <div className="flex items-center gap-2 mb-4">
        <Maximize className="w-5 h-5 text-[#397363]" />
        <h3 className="text-[#10231F] font-bold text-sm">Resize Image</h3>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleModeChange('original')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
              resizeOptions.mode === 'original'
                ? 'bg-[#10231F] text-white border-[#10231F]'
                : 'bg-white text-[#10231F]/70 border-[#DDE7E2] hover:bg-[#F7FAF8]'
            }`}
          >
            Original
          </button>
          <button
            onClick={() => handleModeChange('percentage')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
              resizeOptions.mode === 'percentage'
                ? 'bg-[#10231F] text-white border-[#10231F]'
                : 'bg-white text-[#10231F]/70 border-[#DDE7E2] hover:bg-[#F7FAF8]'
            }`}
          >
            <Percent className="w-3.5 h-3.5" /> Scale
          </button>
          <button
            onClick={() => handleModeChange('dimensions')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 ${
              resizeOptions.mode === 'dimensions'
                ? 'bg-[#10231F] text-white border-[#10231F]'
                : 'bg-white text-[#10231F]/70 border-[#DDE7E2] hover:bg-[#F7FAF8]'
            }`}
          >
            <Hash className="w-3.5 h-3.5" /> Custom
          </button>
        </div>

        {resizeOptions.mode === 'percentage' && (
          <div className="bg-[#F7FAF8] p-3 rounded-xl space-y-2 border border-[#E9F0EC]">
            <label className="text-xs font-bold text-[#10231F]/70 flex justify-between">
              <span>Scale Percentage</span>
              <span className="text-[#5EE0B5] bg-[#10231F] px-1.5 py-0.5 rounded text-[10px]">{resizeOptions.percentage}%</span>
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={resizeOptions.percentage}
              onChange={handlePercentageChange}
              className="w-full accent-[#5EE0B5]"
            />
            {originalDimensions && (
              <div className="text-[10px] text-[#10231F]/50 text-right mt-1 font-semibold">
                Output: {Math.round(originalDimensions.width * (resizeOptions.percentage / 100))} × {Math.round(originalDimensions.height * (resizeOptions.percentage / 100))}px
              </div>
            )}
          </div>
        )}

        {resizeOptions.mode === 'dimensions' && (
          <div className="bg-[#F7FAF8] p-3 rounded-xl border border-[#E9F0EC]">
            <div className="flex items-center gap-3">
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-[#10231F]/70 uppercase tracking-wider">Width</label>
                <div className="relative">
                  <input
                    type="number"
                    value={resizeOptions.width || ''}
                    onChange={handleWidthChange}
                    className="w-full bg-white border border-[#DDE7E2] rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-[#10231F] outline-none focus:border-[#5EE0B5] transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#10231F]/40 font-bold pointer-events-none">px</span>
                </div>
              </div>
              <div className="text-[#10231F]/30 font-bold text-sm mt-5">×</div>
              <div className="flex-1 space-y-1.5">
                <label className="text-[10px] font-bold text-[#10231F]/70 uppercase tracking-wider">Height</label>
                <div className="relative">
                  <input
                    type="number"
                    value={resizeOptions.height || ''}
                    onChange={handleHeightChange}
                    className="w-full bg-white border border-[#DDE7E2] rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-[#10231F] outline-none focus:border-[#5EE0B5] transition-colors"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#10231F]/40 font-bold pointer-events-none">px</span>
                </div>
              </div>
            </div>
            {originalDimensions && (
              <p className="text-[10px] text-[#10231F]/50 mt-2 font-semibold">
                Aspect ratio is automatically locked to original ({originalDimensions.width} × {originalDimensions.height}).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
