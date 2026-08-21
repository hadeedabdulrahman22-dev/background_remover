import React from 'react';
import { Zap, Sparkles, Layers } from 'lucide-react';

export const FeatureStrip: React.FC = () => {
  return (
    <div id="feature-strip" className="flex items-center justify-around py-3 px-4 bg-white/70 backdrop-blur-xs border border-[#DDE7E2] rounded-2xl shadow-2xs">
      <div className="flex flex-col items-center gap-1 text-center">
        <div className="w-8 h-8 rounded-full bg-[#E2FAF1] flex items-center justify-center text-[#176B51]">
          <Zap className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-[#10231F]">Fast</span>
        <span className="text-[10px] text-gray-500">Instant cuts</span>
      </div>

      <div className="w-px h-8 bg-[#DDE7E2]" />

      <div className="flex flex-col items-center gap-1 text-center">
        <div className="w-8 h-8 rounded-full bg-[#E2FAF1] flex items-center justify-center text-[#176B51]">
          <Sparkles className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-[#10231F]">Full quality</span>
        <span className="text-[10px] text-gray-500">HD resolution</span>
      </div>

      <div className="w-px h-8 bg-[#DDE7E2]" />

      <div className="flex flex-col items-center gap-1 text-center">
        <div className="w-8 h-8 rounded-full bg-[#E2FAF1] flex items-center justify-center text-[#176B51]">
          <Layers className="w-4 h-4" />
        </div>
        <span className="text-xs font-bold text-[#10231F]">Transparent</span>
        <span className="text-[10px] text-gray-500">Alpha PNG</span>
      </div>
    </div>
  );
};
