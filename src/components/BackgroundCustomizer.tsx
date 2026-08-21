import React from 'react';
import { BackgroundOption, BackgroundMode } from '../types';
import { Check, Palette, Sparkles } from 'lucide-react';

interface BackgroundCustomizerProps {
  selectedBg: BackgroundOption;
  onSelectBg: (option: BackgroundOption) => void;
  customColor: string;
  onCustomColorChange: (color: string) => void;
}

export const PRESET_BACKGROUNDS: BackgroundOption[] = [
  { id: 'transparent', name: 'Transparent', type: 'transparent', value: 'transparent' },
  { id: 'white', name: 'Clean White', type: 'color', value: '#FFFFFF' },
  { id: 'offwhite', name: 'Studio Cream', type: 'color', value: '#F4F4F0' },
  { id: 'mint-light', name: 'Soft Mint', type: 'color', value: '#E2FAF1' },
  { id: 'ink-dark', name: 'Deep Ink', type: 'color', value: '#10231F' },
  { id: 'blue', name: 'Sky Blue', type: 'color', value: '#E0F2FE' },
  { id: 'gradient-mint', name: 'Mint Glow', type: 'gradient', value: 'linear-gradient(135deg, #5EE0B5 0%, #10231F 100%)' },
  { id: 'gradient-sunset', name: 'Warm Sunset', type: 'gradient', value: 'linear-gradient(135deg, #FDE68A 0%, #F43F5E 100%)' },
  { id: 'gradient-pastel', name: 'Pastel Aura', type: 'gradient', value: 'linear-gradient(135deg, #E0E7FF 0%, #FCE7F3 100%)' },
];

export const BackgroundCustomizer: React.FC<BackgroundCustomizerProps> = ({
  selectedBg,
  onSelectBg,
  customColor,
  onCustomColorChange,
}) => {
  return (
    <div id="background-customizer" className="bg-white p-4 rounded-2xl border border-[#DDE7E2] shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#397363]" />
          <span className="text-sm font-bold text-[#10231F]">Backdrop & Color</span>
        </div>
        <span className="text-xs text-gray-500 font-medium">{selectedBg.name}</span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
        {PRESET_BACKGROUNDS.map((preset) => {
          const isSelected = selectedBg.id === preset.id;
          return (
            <button
              key={preset.id}
              id={`bg-preset-${preset.id}`}
              onClick={() => onSelectBg(preset)}
              title={preset.name}
              className={`relative shrink-0 w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                isSelected
                  ? 'border-[#10231F] scale-110 shadow-sm ring-2 ring-[#5EE0B5]/50'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
              style={{
                background:
                  preset.type === 'transparent'
                    ? undefined
                    : preset.value,
              }}
            >
              {preset.type === 'transparent' && (
                <div className="w-full h-full rounded-full bg-checkerboard" />
              )}
              {isSelected && (
                <Check
                  className={`w-3.5 h-3.5 ${
                    preset.id === 'white' || preset.id === 'offwhite' || preset.id === 'transparent' || preset.id === 'mint-light' || preset.id === 'blue'
                      ? 'text-[#10231F]'
                      : 'text-white'
                  }`}
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}

        {/* Custom Color Input */}
        <label
          id="bg-preset-custom-picker"
          title="Pick custom color"
          className={`relative shrink-0 w-8 h-8 rounded-full border-2 cursor-pointer flex items-center justify-center transition-all overflow-hidden ${
            selectedBg.id === 'custom'
              ? 'border-[#10231F] scale-110 shadow-sm ring-2 ring-[#5EE0B5]/50'
              : 'border-dashed border-gray-300 hover:border-gray-400'
          }`}
          style={{ backgroundColor: selectedBg.id === 'custom' ? customColor : 'transparent' }}
        >
          <input
            type="color"
            value={customColor}
            onChange={(e) => {
              const val = e.target.value;
              onCustomColorChange(val);
              onSelectBg({
                id: 'custom',
                name: `Custom (${val})`,
                type: 'color',
                value: val,
              });
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          {selectedBg.id === 'custom' ? (
            <Check className="w-3.5 h-3.5 text-white drop-shadow-xs" strokeWidth={3} />
          ) : (
            <span className="text-[10px] font-bold text-gray-500">+</span>
          )}
        </label>
      </div>
    </div>
  );
};
