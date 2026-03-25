import React from "react";

export default function ProgressBar({ files }) {
  if (files.length === 0) return null;

  const doneCount = files.filter((f) => f.status === "done").length;
  const convertingCount = files.filter((f) => f.status === "converting").length;
  const progressPercent = Math.round((doneCount / files.length) * 100);

  return (
    <div className="mb-4">
      <div className="text-sm text-slate-600 mb-1">Conversion progress</div>
      <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
        <div
          className="h-3 bg-sky-500"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>
      <div className="text-xs text-slate-500 mt-1">
        {convertingCount} converting — {doneCount}/{files.length} done
      </div>
    </div>
  );
}
