import React from 'react';
import { Sparkles } from 'lucide-react';

interface SampleImagesProps {
  onSelectSample: (url: string, name: string) => void;
  disabled?: boolean;
}

const SAMPLE_LIST = [
  {
    name: 'Portrait',
    url: '/samples/portrait.jpg',
    tag: 'Portrait',
  },
  {
    name: 'Puppy',
    url: '/samples/puppy.jpg',
    tag: 'Pet',
  },
  {
    name: 'Sneaker',
    url: '/samples/sneaker.jpg',
    tag: 'Product',
  },
  {
    name: 'Monstera',
    url: '/samples/monstera.jpg',
    tag: 'Object',
  },
];

export const SampleImages: React.FC<SampleImagesProps> = ({ onSelectSample, disabled }) => {
  return (
    <div id="sample-images-section" className="mt-4 pt-4 border-t border-[#E6EFEA]">
      <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#397363]" />
          <span>No image handy? Try a sample:</span>
        </div>
        <span className="text-[10px] bg-[#E8F8F2] text-[#1E7D58] font-bold px-2 py-0.5 rounded-full border border-[#C5EDE0]">
          ⚡ Instant AI Demo
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SAMPLE_LIST.map((sample, idx) => (
          <button
            key={idx}
            id={`btn-sample-image-${idx}`}
            disabled={disabled}
            onClick={() => onSelectSample(sample.url, `${sample.name.toLowerCase()}.jpg`)}
            className="group relative aspect-square rounded-xl overflow-hidden border border-[#DDE7E2] hover:border-[#5EE0B5] transition-all hover:scale-103 focus:outline-hidden disabled:opacity-50"
          >
            <img
              src={sample.url}
              alt={sample.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-1.5">
              <span className="text-[10px] font-bold text-white leading-tight">
                {sample.name}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
