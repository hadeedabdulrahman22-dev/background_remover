import { BackgroundOption } from '../types';

/**
 * Creates a downloadable PNG file from the result image, applying any custom background color or preserving alpha transparency.
 */
export async function exportImage(
  resultUrl: string,
  background: BackgroundOption,
  customColor: string,
  baseFileName: string = 'clearcut'
): Promise<void> {
  const timestamp = Date.now();
  const cleanName = baseFileName.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const downloadFileName = `${cleanName}_nobg_${timestamp}.png`;

  // If transparent background is selected, download directly from blob/data URL without re-encoding
  if (background.type === 'transparent') {
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

  // If solid color or gradient background is selected, composite onto canvas
  return new Promise((resolve, reject) => {
    const img = new Image();

    // Only set crossOrigin for external remote URLs, NEVER for blob: or data: URLs (which cause CORS error events)
    if (!resultUrl.startsWith('blob:') && !resultUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 800;
        canvas.height = img.naturalHeight || img.height || 600;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Canvas context could not be created');
        }

        // Draw background
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
        }

        // Draw cutout on top
        ctx.drawImage(img, 0, 0);

        // Export as PNG
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas blob generation failed'));
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = downloadFileName;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
          }, 100);
          resolve();
        }, 'image/png');
      } catch (err: any) {
        reject(new Error(err?.message || 'Error compositing image with background'));
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load cutout image for exporting'));
    };

    img.src = resultUrl;
  });
}

/**
 * Converts a data URL or Blob to a File object
 */
export async function applyBackgroundToCanvas(
  resultUrl: string,
  background: BackgroundOption,
  customColor: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!resultUrl.startsWith('blob:') && !resultUrl.startsWith('data:')) {
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
        }

        ctx.drawImage(img, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Blob generation failed'));
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load cutout image'));
    img.src = resultUrl;
  });
}

export function blobToFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || 'image/png' });
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

export async function removeBackgroundServer(source: File | string, fileName?: string): Promise<Blob> {
  const formData = new FormData();
  
  if (source instanceof File) {
    formData.append('file', source);
  } else {
    // If it's a blob URL from client-side cropping, we need to fetch it first to convert to blob
    const response = await fetch(source);
    const blob = await response.blob();
    formData.append('file', blob, fileName || 'upload.png');
  }

  const endpoint = '/api/remove-background';
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  const contentType = response.headers.get('content-type') || '';

  if (response.ok && contentType.includes('image/')) {
    return await response.blob();
  }

  if (response.ok) {
    const jsonData = await response.json().catch(() => ({}));
    if (jsonData.fallbackRequired) {
      console.log('Server requested client-side fallback...');
      const fallbackUrl = source instanceof File ? URL.createObjectURL(source) : source;
      try {
        const fallbackBlob = await removeBackgroundClientSide(fallbackUrl);
        if (source instanceof File) URL.revokeObjectURL(fallbackUrl);
        return fallbackBlob;
      } catch (err) {
        if (source instanceof File) URL.revokeObjectURL(fallbackUrl);
        throw err;
      }
    }
  }

  // If server returned non-OK status, try client-side edge segmentation before showing error
  console.log('Server response non-OK, applying client-side segmentation fallback...');
  const fallbackUrl = source instanceof File ? URL.createObjectURL(source) : source;
  try {
    const fallbackBlob = await removeBackgroundClientSide(fallbackUrl);
    if (source instanceof File) URL.revokeObjectURL(fallbackUrl);
    return fallbackBlob;
  } catch (err) {
    if (source instanceof File) URL.revokeObjectURL(fallbackUrl);
    throw new Error('Background removal failed');
  }
}

/**
 * Client-side smart edge/background extraction fallback
 */
export async function removeBackgroundClientSide(imageSrc: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageSrc.startsWith('blob:') && !imageSrc.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('Could not get canvas context');

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Sample background color from corners and borders
        const samples: [number, number, number][] = [];
        const samplePoints = [
          [2, 2], [width - 3, 2], [2, height - 3], [width - 3, height - 3],
          [Math.floor(width / 2), 2], [Math.floor(width / 2), height - 3],
          [2, Math.floor(height / 2)], [width - 3, Math.floor(height / 2)]
        ];

        for (const [sx, sy] of samplePoints) {
          const idx = (sy * width + sx) * 4;
          samples.push([data[idx], data[idx + 1], data[idx + 2]]);
        }

        // Calculate average background color
        let bgR = 0, bgG = 0, bgB = 0;
        for (const [r, g, b] of samples) {
          bgR += r;
          bgG += g;
          bgB += b;
        }
        bgR /= samples.length;
        bgG /= samples.length;
        bgB /= samples.length;

        // Flood-like alpha mask calculation with soft edge blending
        const tolerance = 45;
        const softRange = 25;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Compute color distance to background sample
          let minDiff = 999999;
          for (const [sr, sg, sb] of samples) {
            const diff = Math.sqrt(
              Math.pow(r - sr, 2) * 0.299 +
              Math.pow(g - sg, 2) * 0.587 +
              Math.pow(b - sb, 2) * 0.114
            );
            if (diff < minDiff) minDiff = diff;
          }

          if (minDiff < tolerance) {
            data[i + 3] = 0; // completely transparent
          } else if (minDiff < tolerance + softRange) {
            const factor = (minDiff - tolerance) / softRange;
            data[i + 3] = Math.round(255 * factor); // soft antialiased edge
          }
        }

        ctx.putImageData(imgData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/png');
      } catch (err: any) {
        reject(err);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for client-side processing'));
    img.src = imageSrc;
  });
}

