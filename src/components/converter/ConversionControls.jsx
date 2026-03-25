import React from "react";

export default function ConversionControls({
  files,
  quality,
  onQualityChange,
  onConvertAll,
  onDownloadZip,
  onClearAll,
}) {
  if (files.length === 0) return null;

  const handleQualityChange = (e) => {
    const el = e.target;
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const val = (parseFloat(el.value) - min) / (max - min);
    el.style.setProperty("--range-val", `${val * 100}%`);
    onQualityChange(parseFloat(e.target.value));
  };

  const handleQualityInput = (e) => {
    const el = e.target;
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const val = (parseFloat(el.value) - min) / (max - min);
    el.style.setProperty("--range-val", `${val * 100}%`);
  };

  return (
    <div className="flex items-center justify-between gap-4 max-sm:flex-col">
      <label className="flex items-center gap-3 max-sm:w-full">
        <span className="text-sm">JPG Quality:</span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.01"
          value={quality}
          className="range-slider"
          style={{ "--range-val": `${((quality - 0.1) / 0.9) * 100}%` }}
          onChange={handleQualityChange}
          onInput={handleQualityInput}
        />
        <span className="text-sm w-12 text-right">
          {Math.round(quality * 100)}%
        </span>
      </label>
      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button
          className="w-full sm:w-auto px-4 py-3 bg-sky-600 text-white rounded text-center"
          onClick={onConvertAll}
        >
          Convert All
        </button>

        <button
          className="w-full sm:w-auto px-4 py-3 bg-emerald-500 text-white rounded flex items-center justify-center gap-2"
          onClick={onDownloadZip}
        >
          Download All as ZIP
        </button>

        <button
          className="w-full sm:w-auto px-4 py-3 bg-red-500 text-white rounded text-center"
          onClick={onClearAll}
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
