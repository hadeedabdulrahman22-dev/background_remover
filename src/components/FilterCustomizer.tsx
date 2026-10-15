import React from 'react';
import { ImageFilter } from '../types';
import { Settings2, Image as ImageIcon, Sparkles } from 'lucide-react';

interface FilterCustomizerProps {
  cutoutFilter: ImageFilter;
  setCutoutFilter: (filter: ImageFilter) => void;
  bgFilter: ImageFilter;
  setBgFilter: (filter: ImageFilter) => void;
}

const FILTERS: { id: ImageFilter; label: string }[] = [
  { id: 'none', label: 'Normal' },
  { id: 'grayscale', label: 'B&W' },
  { id: 'sepia', label: 'Sepia' },
  { id: 'contrast', label: 'High Contrast' }
];

export const FilterCustomizer: React.FC<FilterCustomizerProps> = ({
  cutoutFilter,
  setCutoutFilter,
  bgFilter,
  setBgFilter,
}) => {
  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#DDE7E2]">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="w-5 h-5 text-[#397363]" />
        <h3 className="text-[#10231F] font-bold text-sm">Image Filters</h3>
      </div>

      <div className="space-y-4">
        {/* Cutout Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#10231F]/60 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Subject Filter
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map((f) => (
              <button
                key={`cutout-${f.id}`}
                onClick={() => setCutoutFilter(f.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  cutoutFilter === f.id
                    ? 'bg-[#10231F] border-[#10231F] text-white shadow-sm'
                    : 'bg-white border-[#DDE7E2] text-[#10231F]/70 hover:bg-[#F7FAF8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Background Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#10231F]/60 flex items-center gap-1.5 uppercase tracking-wider">
            <ImageIcon className="w-3.5 h-3.5" /> Background Filter
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {FILTERS.map((f) => (
              <button
                key={`bg-${f.id}`}
                onClick={() => setBgFilter(f.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  bgFilter === f.id
                    ? 'bg-[#10231F] border-[#10231F] text-white shadow-sm'
                    : 'bg-white border-[#DDE7E2] text-[#10231F]/70 hover:bg-[#F7FAF8]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
