import React from "react";
import FilePreview from "./FilePreview";
import FileControls from "./FileControls";

function isHeicFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const type = (file.type || "").toLowerCase();
  return (
    /\.(heic|heif)$/i.test(name) ||
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence"
  );
}

export default function FileItem({
  item,
  idx,
  isLoading,
  shareAvailable,
  onConvert,
  onShare,
  onRemove,
}) {
  const { file, preview, convertedBlob, convertedUrl, convertedName, status } =
    item;
  const isHeic = isHeicFile(file);

  return (
    <div
      key={idx}
      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 border rounded"
    >
      <FilePreview
        file={file}
        preview={preview}
        convertedUrl={convertedUrl}
        status={status}
        isLoading={isLoading}
        isHeic={isHeic}
      />
      <FileControls
        file={file}
        convertedBlob={convertedBlob}
        convertedUrl={convertedUrl}
        convertedName={convertedName}
        status={status}
        isLoading={isLoading}
        shareAvailable={shareAvailable}
        onConvert={() => onConvert(idx)}
        onDownload={() => {}}
        onShare={() => onShare(idx)}
        onRemove={() => onRemove(idx)}
      />
    </div>
  );
}
