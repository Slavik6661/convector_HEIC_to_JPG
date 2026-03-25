import React from "react";

export default function DropZone({
  filesCount,
  isLimitFiles,
  lowMemory,
  onDrop,
  onDragOver,
  onDragLeave,
  onClick,
  onKeyDown,
  fileInputRef,
  onFileInputChange,
}) {
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDrop(e.dataTransfer.files);
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        onDragLeave(e);
      }}
      onDrop={handleDrop}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`border-2 border-dashed border-slate-200 py-8 px-4 sm:p-6 rounded cursor-pointer text-center hover:border-sky-300 transition drop-active`}
      role="button"
      tabIndex={0}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        disabled={!isLimitFiles}
        accept=".heic,.heif,.jpg,.jpeg,image/heic,image/heif,image/jpeg"
        className="hidden"
        onChange={(e) => onFileInputChange(e.target.files)}
      />

      {isLimitFiles !== 0 ? (
        <div className="text-lg font-medium text-base sm:text-lg">
          Drag & Drop HEIC/HEIF/JPEG files here, or tap to select {filesCount}
        </div>
      ) : (
        <div className="text-lg font-medium text-base sm:text-lg">
          The limit is 30 files at a time
        </div>
      )}

      <div className="text-sm text-slate-400 mt-2">
        Files are converted in your browser. They never leave your device.
      </div>
      {lowMemory && (
        <div className="text-xs text-slate-400 mt-2">
          On low-memory devices, previews may be limited to keep conversion
          stable.
        </div>
      )}
    </div>
  );
}
