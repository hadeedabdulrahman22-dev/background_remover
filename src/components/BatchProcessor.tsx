import React, { useState, useRef } from 'react';
import JSZip from 'jszip';
import { Upload, X, Play, Download, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { BatchItem, BackgroundOption } from '../types';
import { removeBackgroundServer, applyBackgroundToCanvas } from '../utils/imageUtils';

interface BatchProcessorProps {
  onClose: () => void;
  selectedBg: BackgroundOption;
  customColor: string;
}

const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export const BatchProcessor: React.FC<BatchProcessorProps> = ({ onClose, selectedBg, customColor }) => {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems: BatchItem[] = [];
      Array.from(e.target.files).forEach((file) => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (ALLOWED_EXTENSIONS.includes(ext) || file.type.startsWith('image/')) {
          if (file.size <= MAX_BYTES) {
            newItems.push({
              id: Math.random().toString(36).substr(2, 9),
              file,
              originalUrl: URL.createObjectURL(file),
              status: 'pending',
            });
          }
        }
      });
      setItems((prev) => [...prev, ...newItems]);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeBatchItem = (id: string) => {
    setItems((prev) => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.originalUrl);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const startBatchProcess = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    const pendingItems = items.filter(i => i.status !== 'done');
    const concurrency = 2;
    let currentIndex = 0;

    const processItem = async (item: BatchItem) => {
      setItems(prev => prev.map(p => p.id === item.id ? { ...p, status: 'processing' } : p));

      try {
        const resultBlob = await removeBackgroundServer(item.file, item.file.name);
        const resultUrl = URL.createObjectURL(resultBlob);
        
        setItems(prev => prev.map(p => p.id === item.id ? {
          ...p,
          status: 'done',
          resultBlob,
          resultUrl
        } : p));
      } catch (err: any) {
        setItems(prev => prev.map(p => p.id === item.id ? {
          ...p,
          status: 'error',
          error: err.message || 'Failed'
        } : p));
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, pendingItems.length) }, async () => {
      while (currentIndex < pendingItems.length) {
        const itemToProcess = pendingItems[currentIndex++];
        if (itemToProcess) {
          await processItem(itemToProcess);
        }
      }
    });

    await Promise.all(workers);
    setIsProcessing(false);
  };

  const downloadAll = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      const doneItems = items.filter(i => i.status === 'done' && i.resultBlob);
      if (doneItems.length === 0) return;

      for (const item of doneItems) {
        if (!item.resultBlob) continue;
        
        // If transparent, we can just use the blob directly.
        // But if they selected a background, we should apply it first.
        let finalBlob = item.resultBlob;
        if (selectedBg.type !== 'transparent') {
            finalBlob = await applyBackgroundToCanvas(item.resultUrl!, selectedBg, customColor);
        }

        const baseName = item.file.name.replace(/\.[^/.]+$/, "");
        zip.file(`${baseName}_nobg.png`, finalBlob);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clearcut_batch_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

    } catch (err) {
      console.warn('Error zipping files:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const progressCount = items.filter(i => i.status === 'done' || i.status === 'error').length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? (progressCount / totalCount) * 100 : 0;

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-[32px] overflow-hidden shadow-2xl relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#DDE7E2] flex items-center justify-between bg-white z-10">
        <h2 className="text-lg font-extrabold text-[#10231F]">Batch Process</h2>
        <button
          onClick={onClose}
          className="p-2 text-[#10231F]/60 hover:text-[#10231F] hover:bg-[#F2F6F4] rounded-full transition-colors"
          disabled={isProcessing}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 bg-[#F2F6F4]">
        {items.length === 0 ? (
          <div 
            className="w-full h-full flex flex-col items-center justify-center border-2 border-dashed border-[#DDE7E2] rounded-2xl bg-white cursor-pointer hover:bg-[#F9FBFB] transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-16 h-16 bg-[#E8F0EC] rounded-2xl flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-[#397363]" />
            </div>
            <p className="text-[#10231F] font-bold text-lg mb-1">Upload Multiple Images</p>
            <p className="text-[#397363] text-sm font-medium">Click to browse files</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {/* Add More Button */}
              {!isProcessing && (
                <div 
                  className="aspect-square rounded-xl border-2 border-dashed border-[#DDE7E2] bg-white flex flex-col items-center justify-center cursor-pointer hover:bg-[#F9FBFB] transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-[#397363] mb-2" />
                  <span className="text-xs font-bold text-[#397363]">Add More</span>
                </div>
              )}

              {/* Items */}
              {items.map((item) => (
                <div key={item.id} className="aspect-square rounded-xl bg-white overflow-hidden shadow-sm relative group border border-[#DDE7E2]">
                  {/* Status Overlay */}
                  <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center bg-black/5">
                    {item.status === 'processing' && (
                      <div className="bg-white/90 p-2 rounded-full shadow-lg backdrop-blur-sm animate-pulse">
                        <Loader2 className="w-6 h-6 text-[#5EE0B5] animate-spin" />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="absolute top-2 right-2 bg-white rounded-full shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-[#5EE0B5]" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="absolute top-2 right-2 bg-white rounded-full shadow-sm">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                      </div>
                    )}
                  </div>
                  
                  {/* Delete Button (only when not processing) */}
                  {!isProcessing && item.status !== 'processing' && (
                    <button 
                      onClick={() => removeBatchItem(item.id)}
                      className="absolute top-2 left-2 z-20 p-1.5 bg-white/90 hover:bg-white text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Image */}
                  <img 
                    src={item.resultUrl || item.originalUrl} 
                    alt="batch item" 
                    className={`w-full h-full object-cover transition-opacity ${item.status === 'processing' ? 'opacity-50 blur-sm' : 'opacity-100'}`}
                    style={item.resultUrl ? { 
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'16\' height=\'16\' viewBox=\'0 0 16 16\' fill=\'none\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h8v8H0V0zm8 8h8v8H8V8z\' fill=\'%23e5e7eb\'/%3E%3Cpath d=\'M8 0h8v8H8V0zM0 8h8v8H0V8z\' fill=\'%23f3f4f6\'/%3E%3C/svg%3E")',
                      backgroundSize: '16px 16px'
                    } : {}}
                  />
                  
                  {/* Progress Bar (Bottom Edge) */}
                  <div className="absolute bottom-0 left-0 w-full h-1.5 bg-[#F2F6F4]">
                    <div 
                      className={`h-full transition-all duration-500 ${item.status === 'done' ? 'bg-[#5EE0B5]' : item.status === 'error' ? 'bg-red-500' : 'bg-[#397363]'}`}
                      style={{ 
                        width: item.status === 'done' || item.status === 'error' ? '100%' : item.status === 'processing' ? '50%' : '0%' 
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      {items.length > 0 && (
        <div className="px-6 py-4 bg-white border-t border-[#DDE7E2] flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex-1 w-full text-sm font-bold text-[#397363]">
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-[#F2F6F4] rounded-full overflow-hidden">
                  <div className="h-full bg-[#5EE0B5] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
                </div>
                <span>{progressCount} / {totalCount}</span>
              </div>
            ) : (
              <span>{items.length} images ready</span>
            )}
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            {progressCount === totalCount && totalCount > 0 ? (
              <button
                onClick={downloadAll}
                disabled={isZipping || items.filter(i => i.status === 'done').length === 0}
                className="flex-1 sm:flex-none py-3 px-6 bg-[#10231F] hover:bg-[#17332D] disabled:bg-[#10231F]/50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                {isZipping ? <Loader2 className="w-5 h-5 animate-spin text-[#5EE0B5]" /> : <Download className="w-5 h-5 text-[#5EE0B5]" />}
                <span>Download ZIP</span>
              </button>
            ) : (
              <button
                onClick={startBatchProcess}
                disabled={isProcessing}
                className="flex-1 sm:flex-none py-3 px-6 bg-[#10231F] hover:bg-[#17332D] disabled:bg-[#10231F]/50 text-white font-extrabold text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <Play className="w-5 h-5 text-[#5EE0B5]" />
                <span>{isProcessing ? 'Processing...' : 'Start Batch'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
      />
    </div>
  );
};
