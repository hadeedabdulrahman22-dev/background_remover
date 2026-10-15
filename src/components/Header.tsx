import React, { useState, useEffect } from 'react';
import { Scissors, KeyRound, RefreshCw, Download } from 'lucide-react';

interface HeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, showReset }) => {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  return (
    <header className="flex items-center justify-between gap-3 w-full">
      <div className="flex items-center gap-3">
        <div 
          id="brand-logo"
          className="w-10 h-10 md:w-11 md:h-11 bg-[#10231F] rounded-xl flex items-center justify-center shadow-sm shrink-0 transition-transform hover:scale-105"
        >
          <Scissors className="w-5 h-5 md:w-6 md:h-6 text-[#5EE0B5]" strokeWidth={2.4} />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-[#10231F] flex items-center gap-1.5">
            ClearCut
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {installPrompt && !isStandalone && (
          <button
            onClick={handleInstallClick}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5EE0B5] hover:bg-[#4DD0A5] text-[#10231F] rounded-full text-xs md:text-sm font-bold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install App</span>
          </button>
        )}
        <div 
          id="badge-no-api-key"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#DDE7E2] rounded-full text-xs md:text-sm font-semibold text-[#10231F] shadow-xs"
        >
          <KeyRound className="w-3.5 h-3.5 text-[#397363]" />
          <span>No API key required</span>
        </div>

        {showReset && (
          <button
            id="btn-header-reset"
            onClick={onReset}
            title="Start with new image"
            className="p-2 bg-white hover:bg-[#E2FAF1] text-[#10231F] border border-[#DDE7E2] rounded-full transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
