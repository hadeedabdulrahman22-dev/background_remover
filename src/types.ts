export type AppMode = 'single' | 'batch';

export type WorkState = 'empty' | 'ready' | 'processing' | 'done';

export interface ImageFile {
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  file?: File;
}

export type BackgroundMode = 'transparent' | 'color' | 'gradient' | 'blur';

export interface BackgroundOption {
  id: string;
  name: string;
  type: BackgroundMode;
  value: string; // hex, gradient string, or special value
}

export interface BatchItem {
  id: string;
  file: File;
  originalUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  resultBlob?: Blob;
  resultUrl?: string;
  error?: string;
}
