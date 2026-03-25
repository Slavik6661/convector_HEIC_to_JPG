# HEIC to JPG Converter (client-side)

Simple single-page React + Vite app that converts HEIC/HEIF images to JPG entirely in the browser.

Features:

- Drag & Drop or click to select HEIC/.heif files
- Client-side conversion using `heic2any`
- Quality slider (default 90%)
- Preview original and converted images
- Download each JPG or all as ZIP (JSZip)
- Responsive UI with Tailwind (Neumorphism/Glassmorphism touches)
- SEO via `react-helmet-async` and JSON-LD
- Ad placeholders for AdSense (commented snippet in `AdComponent`)

Installation

1. Install dependencies

```bash
npm install
```

2. Run dev server

```bash
npm run dev
```

Build

```bash
npm run build
```

Notes

- Replace AdSense placeholders in `src/components/AdComponent.jsx` with your real `data-ad-client` and `data-ad-slot`.
- All conversion happens locally in the browser — files are not uploaded to any server.
- If you need better HEIC support across devices, consider polyfills or using `libheif-js` variations.
- If you need better HEIC support across devices, consider polyfills or using `libheif-js` variations.
- UX improvements: per-file status, spinner during conversion, preview generation and concurrency-limited conversions are implemented.
- UX improvements: per-file status, spinner during conversion, preview generation and concurrency-limited conversions are implemented.
- Added global progress bar showing overall conversion progress and current converting count.
- Added global progress bar showing overall conversion progress and current converting count.
- Removed the High-res preview action (per user request).
- Improved mobile responsiveness: touch-friendly dropzone, stacked buttons on small screens, full-width action buttons and larger touch targets.
