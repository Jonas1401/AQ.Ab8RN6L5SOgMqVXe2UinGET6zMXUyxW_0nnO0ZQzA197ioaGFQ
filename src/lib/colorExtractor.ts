/**
 * Utility to extract dominant and vibrant colors from an image on the client side.
 * Supports fallback colors in case of CORS or load errors.
 */

export interface ColorPalette {
  primary: string;       // Hex color (e.g., "#FF7A00")
  primaryRgb: string;    // "255, 122, 0"
  primaryLight: string;  // Hex (lighter)
  primaryDark: string;   // Hex (darker)
  bgSoft: string;        // "rgba(r, g, b, 0.1)"
  borderSoft: string;    // "rgba(r, g, b, 0.25)"
  glow: string;          // "rgba(r, g, b, 0.4)"
}

// Default Port Hub Orange Palette
export const DEFAULT_PALETTE: ColorPalette = {
  primary: '#FF7A00',
  primaryRgb: '255, 122, 0',
  primaryLight: '#FF952B',
  primaryDark: '#D46200',
  bgSoft: 'rgba(255, 122, 0, 0.1)',
  borderSoft: 'rgba(255, 122, 0, 0.25)',
  glow: 'rgba(255, 122, 0, 0.4)',
};

// Convert RGB to Hex
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.max(0, Math.min(255, c)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Convert Hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Create a complete palette from a primary RGB color
export function createPaletteFromRgb(r: number, g: number, b: number): ColorPalette {
  const primary = rgbToHex(r, g, b);
  
  // Create lighter version
  const rLight = Math.min(255, Math.round(r + (255 - r) * 0.2));
  const gLight = Math.min(255, Math.round(g + (255 - g) * 0.2));
  const bLight = Math.min(255, Math.round(b + (255 - b) * 0.2));
  const primaryLight = rgbToHex(rLight, gLight, bLight);

  // Create darker version
  const rDark = Math.max(0, Math.round(r * 0.8));
  const gDark = Math.max(0, Math.round(g * 0.8));
  const bDark = Math.max(0, Math.round(b * 0.8));
  const primaryDark = rgbToHex(rDark, gDark, bDark);

  return {
    primary,
    primaryRgb: `${r}, ${g}, ${b}`,
    primaryLight,
    primaryDark,
    bgSoft: `rgba(${r}, ${g}, ${b}, 0.1)`,
    borderSoft: `rgba(${r}, ${g}, ${b}, 0.25)`,
    glow: `rgba(${r}, ${g}, ${b}, 0.4)`,
  };
}

// Heuristics for common default backgrounds to look extremely polished
function getPresetPalette(url: string): ColorPalette | null {
  if (!url) return null;
  // If the default Unsplash truck image (yellowish/orange truck)
  if (url.includes('photo-1578575437130-527eed3abbec')) {
    return createPaletteFromRgb(245, 158, 11); // Amber / Yellow truck style (#F59E0B)
  }
  // Other potential mock Unsplash images (trucks are often blue or red or orange)
  if (url.includes('truck')) {
    return createPaletteFromRgb(14, 165, 233); // Cyan / Blue truck (#0EA5E9)
  }
  return null;
}

/**
 * Extracts dominant/vibrant colors from an image URL or Base64 string.
 */
export function extractDominantColor(imageUrl: string): Promise<ColorPalette> {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(DEFAULT_PALETTE);
      return;
    }

    const preset = getPresetPalette(imageUrl);
    if (preset) {
      resolve(preset);
      return;
    }

    const img = new Image();
    
    // Set crossOrigin if it is an external URL to avoid canvas tainted security error
    if (!imageUrl.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        ctx.drawImage(img, 0, 0, 16, 16);
        const imgData = ctx.getImageData(0, 0, 16, 16).data;

        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let validPixels = 0;

        // Try to find the most vibrant color (highest saturation)
        let maxSaturation = -1;
        let vibrantR = 255;
        let vibrantG = 122;
        let vibrantB = 0;

        for (let i = 0; i < imgData.length; i += 4) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          // Skip extremely transparent, pure black, or pure white pixels
          if (a < 150) continue;
          const brightness = (r * 299 + g * 587 + b * 114) / 1000;
          if (brightness < 15 || brightness > 240) continue;

          rSum += r;
          gSum += g;
          bSum += b;
          validPixels++;

          // Calculate simple saturation
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const delta = maxVal - minVal;
          const saturation = maxVal === 0 ? 0 : delta / maxVal;

          if (saturation > maxSaturation && maxVal > 60 && maxVal < 225) {
            maxSaturation = saturation;
            vibrantR = r;
            vibrantG = g;
            vibrantB = b;
          }
        }

        if (validPixels === 0) {
          resolve(DEFAULT_PALETTE);
          return;
        }

        // If we found a good vibrant color with decent saturation, use it!
        // Otherwise use the average color.
        let finalR = vibrantR;
        let finalG = vibrantG;
        let finalB = vibrantB;

        if (maxSaturation < 0.2) {
          finalR = Math.round(rSum / validPixels);
          finalG = Math.round(gSum / validPixels);
          finalB = Math.round(bSum / validPixels);
        }

        // Ensure the color is clearly visible and has enough pop (luminance adjustment)
        const finalBrightness = (finalR * 299 + finalG * 587 + finalB * 114) / 1000;
        if (finalBrightness < 50) {
          // Boost brightness of too-dark colors
          finalR = Math.min(255, finalR + 70);
          finalG = Math.min(255, finalG + 70);
          finalB = Math.min(255, finalB + 70);
        } else if (finalBrightness > 220) {
          // Dim down overly bright pastel colors for solid readability
          finalR = Math.max(20, Math.round(finalR * 0.75));
          finalG = Math.max(20, Math.round(finalG * 0.75));
          finalB = Math.max(20, Math.round(finalB * 0.75));
        }

        resolve(createPaletteFromRgb(finalR, finalG, finalB));
      } catch (err) {
        console.warn('Canvas color extraction failed (probably CORS). Using fallback.', err);
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => {
      resolve(DEFAULT_PALETTE);
    };

    img.src = imageUrl;
  });
}
