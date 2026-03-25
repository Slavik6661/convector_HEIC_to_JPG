import React from "react";

export default function FileControls({
  file,
  convertedBlob,
  convertedUrl,
  convertedName,
  status,
  isLoading,
  shareAvailable,
  onConvert,
  onDownload,
  onShare,
  onRemove,
}) {
  return (
    <div className="flex-1 w-full">
      <div className="flex items-center justify-between max-sm:gap-10">
        <div>
          <div className="font-medium">{convertedName || file.name}</div>
          <div className="text-sm text-slate-500">
            Original: {(file.size / 1024).toFixed(2)} KB
          </div>
          {convertedBlob && (
            <div className="text-sm text-slate-500">
              Converted: {(convertedBlob.size / 1024).toFixed(2)} KB
            </div>
          )}
          {status === "error" && (
            <div className="text-sm text-red-500">Error: {file.error}</div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {!convertedBlob && (
            <button
              onClick={onConvert}
              className="w-full sm:w-auto px-3 py-2 bg-emerald-500 text-white rounded flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span className="font-semibold">in progress...</span>
              ) : (
                "Convert"
              )}
            </button>
          )}
          {convertedBlob && (
            <>
              <a
                className="w-full sm:w-auto px-3 py-2 bg-sky-600 text-white rounded text-center"
                href={convertedUrl}
                download={
                  convertedName ||
                  file.name.replace(/\.(heic|heif|jpe?g)$/i, ".jpg")
                }
              >
                Download
              </a>
              {shareAvailable && (
                <button
                  onClick={onShare}
                  className="w-full sm:w-auto px-3 py-2 bg-violet-600 text-white rounded"
                >
                  Share It
                </button>
              )}
            </>
          )}

          <button
            onClick={onRemove}
            className="w-full sm:w-auto px-3 py-2 bg-red-500 text-white rounded"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
