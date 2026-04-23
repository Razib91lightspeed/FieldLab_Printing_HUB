export function normalizeColorCode(color?: string | null): string | null {
  if (!color || color === "Unknown") return null;

  const cleaned = color.trim().replace("#", "");

  // Bambu RGBA like F98C36FF -> #F98C36
  if (/^[0-9A-Fa-f]{8}$/.test(cleaned)) {
    return `#${cleaned.slice(0, 6).toUpperCase()}`;
  }

  // Standard 6-char hex
  if (/^[0-9A-Fa-f]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }

  // Short 3-char hex -> expand
  if (/^[0-9A-Fa-f]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`.toUpperCase();
  }

  return null;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  if (clean.length !== 6) return null;

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) return null;
  return { r, g, b };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }

    h /= 6;
  }

  return {
    h: h * 360,
    s: s * 100,
    l: l * 100,
  };
}

export function getColorLabel(color?: string | null): string {
  const hex = normalizeColorCode(color);
  if (!hex) return "Unknown";

  const rgb = hexToRgb(hex);
  if (!rgb) return "Unknown";

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // neutrals
  if (l < 12) return "Black";
  if (l > 92 && s < 15) return "White";

  if (s < 12) {
    if (l < 35) return "Dark Gray";
    if (l > 75) return "Light Gray";
    return "Gray";
  }

  // brown before orange/yellow
  if (h >= 15 && h < 45 && l < 45) return "Brown";

  if (h < 15 || h >= 345) return "Red";
  if (h >= 15 && h < 45) return "Orange";
  if (h >= 45 && h < 70) return "Yellow";
  if (h >= 70 && h < 160) return "Green";
  if (h >= 160 && h < 200) return "Cyan";
  if (h >= 200 && h < 255) return "Blue";
  if (h >= 255 && h < 290) return "Purple";
  if (h >= 290 && h < 345) return "Pink";

  return "Unknown";
}