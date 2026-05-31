"use client";

/**
 * Subtle film-grain overlay rendered from an inline SVG fractal-noise texture.
 * Mirrors the MULTITONE noise effect from the Figma frame (low opacity grain)
 * while keeping the underlying gradient and content perfectly readable.
 */

const NOISE_SVG = `\
<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'>\
<filter id='n'>\
<feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>\
<feColorMatrix type='saturate' values='0'/>\
</filter>\
<rect width='100%' height='100%' filter='url(%23n)'/>\
</svg>`;

const NOISE_URL = `url("data:image/svg+xml,${encodeURIComponent(NOISE_SVG)}")`;

export function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[15]"
      style={{
        backgroundImage: NOISE_URL,
        backgroundRepeat: "repeat",
        backgroundSize: "160px 160px",
        opacity: 0.16,
        mixBlendMode: "soft-light",
      }}
    />
  );
}
