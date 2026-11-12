#!/usr/bin/env node
/**
 * Generates LearnMyWay PWA icons as SVG files (which vite-plugin-pwa will accept),
 * plus embeds them as PNG-compatible SVG with the right sizes.
 * 
 * vite-plugin-pwa works fine with SVG icons — this writes them to public/icons/.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../public/icons");
fs.mkdirSync(OUT, { recursive: true });

function makeSVG(size, maskable = false) {
  // For maskable, the logo occupies the inner 80% (40% pad on each side)
  const pad = maskable ? size * 0.1 : size * 0.08;
  const logoSize = size - pad * 2;
  const offset = pad;
  const rr = logoSize * 0.22; // corner radius

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <radialGradient id="bg" cx="40%" cy="35%" r="65%" fx="40%" fy="35%">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="50%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4338ca"/>
    </radialGradient>
  </defs>
  <!-- Full background -->
  <rect width="${size}" height="${size}" fill="#09090f"/>
  <!-- Rounded square logo area -->
  <rect x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}" rx="${rr}" ry="${rr}" fill="url(#bg)"/>
  <!-- Graduation cap emoji as text -->
  <text x="${size / 2}" y="${size / 2 + logoSize * 0.07}" 
        font-size="${logoSize * 0.52}" 
        text-anchor="middle" dominant-baseline="middle"
        font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, serif">🎓</text>
</svg>`;
}

const icons = [
  { name: "icon-192.svg", size: 192, maskable: false },
  { name: "icon-512.svg", size: 512, maskable: false },
  { name: "icon-192-maskable.svg", size: 192, maskable: true },
  { name: "icon-512-maskable.svg", size: 512, maskable: true },
];

for (const { name, size, maskable } of icons) {
  const svg = makeSVG(size, maskable);
  fs.writeFileSync(path.join(OUT, name), svg, "utf-8");
  console.log(`✓ public/icons/${name}`);
}

console.log("\nAll SVG icons written.");
console.log("NOTE: vite-plugin-pwa supports SVG icons. Update manifest icon paths to .svg if needed.");
