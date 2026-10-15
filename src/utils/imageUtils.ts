import { removeBackground } from '@imgly/background-removal';
import { BackgroundOption, ImageFilter, ResizeOptions } from '../types';

export function getCssFilterString(filter: ImageFilter): string {
  switch (filter) {
    case 'grayscale': return 'grayscale(100%)';
    case 'sepia': return 'sepia(100%)';
    case 'contrast': return 'contrast(150%)';
    default: return 'none';
  }
}

export async function exportImage(
  resultUrl: string,
  background: BackgroundOption,
  customColor: string,
  baseFileName: string = 'clearcut',
  format: 'png' | 'jpg' = 'png',
  bgFilter: ImageFilter = 'none',
  cutoutFilter: ImageFilter = 'none',
  resizeOptions?: ResizeOptions
): Promise<void> {
  const timestamp = Date.now();
  const cleanName = baseFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = format === 'jpg' ? 'jpg' : 'png';
  const downloadFileName = `${cleanName}_nobg_${timestamp}.${ext}`;

  const hasResize = resizeOptions && resizeOptions.mode !== 'original';
  const hasFilter = bgFilter !== 'none' || cutoutFilter !== 'none';
  if (background.type === 'transparent' && format === 'png' && !hasResize && !hasFilter) {
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = downloadFileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
    return;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!resultUrl.startsWith('blob:') && !resultUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const origWidth = img.naturalWidth || img.width || 800;
        const origHeight = img.naturalHeight || img.height || 600;
        
        let targetWidth = origWidth;
        let targetHeight = origHeight;

        if (resizeOptions && resizeOptions.mode !== 'original') {
          if (resizeOptions.mode === 'percentage') {
            targetWidth = Math.round(origWidth * (resizeOptions.percentage / 100));
            targetHeight = Math.round(origHeight * (resizeOptions.percentage / 100));
          } else if (resizeOptions.mode === 'dimensions') {
            targetWidth = resizeOptions.width || origWidth;
            targetHeight = resizeOptions.height || origHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }

        ctx.filter = getCssFilterString(bgFilter);
        if (background.type === 'color') {
          ctx.fillStyle = background.id === 'custom' ? customColor : background.value;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background.type === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          if (background.id === 'gradient-mint') {
            grad.addColorStop(0, '#5EE0B5');
            grad.addColorStop(1, '#10231F');
          } else if (background.id === 'gradient-sunset') {
            grad.addColorStop(0, '#FDE68A');
            grad.addColorStop(1, '#F43F5E');
          } else {
            grad.addColorStop(0, '#E0E7FF');
            grad.addColorStop(1, '#FCE7F3');
          }
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background.type === 'transparent' && format === 'jpg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.filter = getCssFilterString(cutoutFilter);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        ctx.filter = 'none';

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.92 : undefined;

        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas blob generation failed'));
            return;
          }
          const outputUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = outputUrl;
          a.download = downloadFileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(outputUrl);
            resolve();
          }, 100);
        }, mimeType, quality);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image onto canvas for export'));
    img.src = resultUrl;
  });
}

export async function applyBackgroundToCanvas(
  sourceUrl: string,
  background: BackgroundOption,
  customColor: string,
  format: 'png' | 'jpg' = 'png'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!sourceUrl.startsWith('blob:') && !sourceUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context could not be created');

        if (background.type === 'color') {
          ctx.fillStyle = background.id === 'custom' ? customColor : background.value;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background.type === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          if (background.id === 'gradient-mint') {
            grad.addColorStop(0, '#5EE0B5');
            grad.addColorStop(1, '#10231F');
          } else if (background.id === 'gradient-sunset') {
            grad.addColorStop(0, '#FDE68A');
            grad.addColorStop(1, '#F43F5E');
          } else {
            grad.addColorStop(0, '#E0E7FF');
            grad.addColorStop(1, '#FCE7F3');
          }
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else if (background.type === 'transparent' && format === 'jpg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
        const quality = format === 'jpg' ? 0.92 : undefined;

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, mimeType, quality);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for background application'));
    img.src = sourceUrl;
  });
}

export async function optimizeImageBeforeUpload(blob: Blob, maxDim = 1600): Promise<Blob> {
  // If smaller than 400KB, no need to downscale
  if (blob.size < 400 * 1024) return blob;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w <= maxDim && h <= maxDim && blob.size < 1200 * 1024) {
        return resolve(blob);
      }
      let targetW = w;
      let targetH = h;
      if (w > h) {
        if (w > maxDim) {
          targetW = maxDim;
          targetH = Math.round((h * maxDim) / w);
        }
      } else {
        if (h > maxDim) {
          targetH = maxDim;
          targetW = Math.round((w * maxDim) / h);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(blob);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      canvas.toBlob((resizedBlob) => {
        if (resizedBlob && resizedBlob.size < blob.size) {
          resolve(resizedBlob);
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', 0.93);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    img.src = url;
  });
}

export async function removeBackgroundServer(source: File | string, fileName: string = 'image.png'): Promise<Blob> {
  const formData = new FormData();

  if (source instanceof File) {
    const optimized = await optimizeImageBeforeUpload(source);
    formData.append('file', optimized, source.name || fileName);
    formData.append('format', 'png');
  } else if (typeof source === 'string') {
    let blob: Blob;
    if (source.startsWith('data:')) {
      const arr = source.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'image/png';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      blob = new Blob([u8arr], { type: mime });
    } else if (source.startsWith('blob:') || source.startsWith('/') || !source.startsWith('http')) {
      const res = await fetch(source);
      blob = await res.blob();
    } else {
      const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(source)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Could not fetch image to process.');
      blob = await res.blob();
    }
    const optimized = await optimizeImageBeforeUpload(blob);
    const file = new File([optimized], fileName, { type: optimized.type || 'image/png' });
    formData.append('file', file, fileName);
    formData.append('format', 'png');
  } else {
    throw new Error('Unsupported image source type.');
  }

  const response = await fetch('/api/remove-background', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.details || `Background removal request failed (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await response.json();
    if (json.fallbackRequired) {
      const sourceUrl = source instanceof File ? URL.createObjectURL(source) : source;
      try {
        return await removeBackgroundClientSide(sourceUrl);
      } finally {
        if (source instanceof File) URL.revokeObjectURL(sourceUrl);
      }
    }
    throw new Error(json.error || 'Server did not return cutout image.');
  }

  const resultBlob = await response.blob();
  if (resultBlob.size === 0) {
    throw new Error('Empty image result received from server.');
  }
  return resultBlob;
}

export async function removeBackgroundClientSide(imageSrc: string, onProgress?: (progress: number) => void): Promise<Blob> {
  console.log("Running client-side background removal fallback...");
  try {
    const config = {
      model: 'isnet_quint8' as const,
      device: 'cpu' as const,
      progress: (key: string, current: number, total: number) => {
        if (onProgress && total > 0) {
          onProgress(current / total);
        }
      }
    };
    const blob = await removeBackground(imageSrc, config);
    return blob;
  } catch (err: any) {
    console.warn("Client-side background removal failed:", err);
    throw new Error('Background removal failed: could not isolate subject. Please try another image.');
  }
}

export async function applyCropToImage(
  imageSrc: string,
  cropRect: { x: number; y: number; width: number; height: number }
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!imageSrc.startsWith('blob:') && !imageSrc.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = cropRect.width;
        canvas.height = cropRect.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('No 2d context');
        ctx.drawImage(
          image,
          cropRect.x,
          cropRect.y,
          cropRect.width,
          cropRect.height,
          0,
          0,
          cropRect.width,
          cropRect.height
        );
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas is empty'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    image.onerror = () => reject(new Error('Failed to load image for cropping'));
    image.src = imageSrc;
  });
}

export async function rotateImage(imageUrl: string, angle: number = 90): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');
        if (angle % 180 !== 0) {
          canvas.width = img.naturalHeight || img.height;
          canvas.height = img.naturalWidth || img.width;
        } else {
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
        }
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create rotated blob'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for rotation'));
    img.src = imageUrl;
  });
}
