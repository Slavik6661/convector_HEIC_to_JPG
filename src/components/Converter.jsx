import React, { useState, useRef, useCallback, useEffect } from "react";
import heic2any from "heic2any";
import { HeifFile } from "libheif-js";
import JSZip from "jszip";
import {
  FileItem,
  ProgressBar,
  DropZone,
  ConversionControls,
} from "./converter/index.js";

function getFileFormatLabel(file) {
  if (!file) return "unknown";
  const name = file.name || "";
  const type = file.type || "";
  const extMatch = name.match(/\.([a-z0-9]+)$/i);

  if (extMatch?.[1]) {
    return `.${extMatch[1].toLowerCase()}`;
  }

  if (type) {
    return type.toLowerCase();
  }

  return "unknown";
}

function makeUniqueFileName(fileName, usedNames) {
  const dotIndex = fileName.lastIndexOf(".");
  const hasExtension = dotIndex > 0;
  const baseName = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const extension = hasExtension ? fileName.slice(dotIndex) : "";

  let candidate = fileName;
  let counter = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName} (${counter})${extension}`;
    counter += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function isSupportedImageFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const type = (file.type || "").toLowerCase();
  return (
    /\.(heic|heif)$/i.test(name) ||
    /\.(jpe?g)$/i.test(name) ||
    type === "image/heic" ||
    type === "image/heif" ||
    type === "image/heic-sequence" ||
    type === "image/heif-sequence" ||
    type === "image/jpeg"
  );
}

function isJpegFile(file) {
  if (!file) return false;
  const name = file.name || "";
  const type = (file.type || "").toLowerCase();
  return /\.(jpe?g)$/i.test(name) || type === "image/jpeg";
}

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

function normalizeConversionResult(result) {
  if (Array.isArray(result)) {
    return result[0] || null;
  }
  return result || null;
}

function canvasToJpegBlob(canvas, quality) {
  if (canvas?.toBlob) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (outBlob) => {
          if (outBlob) resolve(outBlob);
          else reject(new Error("Canvas toBlob failed"));
        },
        "image/jpeg",
        quality,
      );
    });
  }

  try {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    const base64 = dataUrl.split(",")[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return Promise.resolve(new Blob([bytes], { type: "image/jpeg" }));
  } catch (e) {
    return Promise.reject(new Error("Canvas export failed"));
  }
}

function detectMobileConstraints() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return {
      isMobile: false,
      lowMemory: false,
      skipPreview: false,
      concurrencyLimit: 2,
    };
  }

  const coarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches;
  const touchDevice = navigator.maxTouchPoints > 0;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent || "",
  );
  const lowMemory =
    typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const isMobile = Boolean(coarsePointer || touchDevice || mobileUa);

  return {
    isMobile,
    lowMemory,
    skipPreview: lowMemory,
    concurrencyLimit: isMobile || lowMemory ? 1 : 2,
  };
}

function canShareFiles() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  if (typeof navigator.share !== "function") {
    return false;
  }

  if (typeof navigator.canShare !== "function") {
    return false;
  }

  try {
    const probeFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    return navigator.canShare({ files: [probeFile] });
  } catch (e) {
    return false;
  }
}

// Helper: Universal HEIC conversion with heic2any (iOS) + libheif-js (Android) fallback
async function convertHeicToJpeg(blob, quality = 0.9, timeoutMs = 30000) {
  console.log(
    `[Convert] Starting with blob ${(blob.size / 1024).toFixed(2)} KB, quality: ${quality}`,
  );

  // Try heic2any first (works on iOS Safari)
  if (typeof heic2any !== "undefined") {
    try {
      console.log("[Convert] Trying heic2any (iOS native API)...");
      const result = await Promise.race([
        heic2any({ blob, toType: "image/jpeg", quality }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("heic2any timeout")), timeoutMs),
        ),
      ]);
      const normalizedResult = normalizeConversionResult(result);
      if (!normalizedResult) {
        throw new Error("heic2any returned no image data");
      }
      console.log("[Convert] heic2any succeeded!");
      return normalizedResult;
    } catch (e) {
      console.warn(
        `[Convert] heic2any failed: ${e.message}. Trying libheif-js fallback...`,
      );
    }
  }

  // Fallback to libheif-js (works on Android + all browsers)
  try {
    console.log("[Convert] Trying libheif-js (WASM)...");
    const arrayBuffer = await blob.arrayBuffer();
    const hf = new HeifFile(new Uint8Array(arrayBuffer));
    const imageIds = hf.getImageIds();

    if (!imageIds || imageIds.length === 0)
      throw new Error("No images in HEIF file");

    const image = hf.getImage(imageIds[0]);
    const canvas = await image.display();
    const outBlob = await canvasToJpegBlob(canvas, quality);
    console.log("[Convert] libheif-js succeeded!");
    return outBlob;
  } catch (e) {
    console.error("[Convert] Both methods failed:", e.message);
    throw e;
  }
}

// Helper: checks if HEIC conversion is available
async function checkHeicSupport() {
  try {
    const hasHeic2any = typeof heic2any !== "undefined";
    console.log(`[Support] heic2any: ${hasHeic2any}, libheif-js: available`);
    return true; // libheif-js is always available after import
  } catch (e) {
    console.warn("[Support] check failed:", e.message);
    return false;
  }
}

export default function Converter() {
  const maxFilesTotal = 30;
  const [files, setFiles] = useState([]); // {file, preview, convertedBlob, convertedUrl, status, error}
  const [quality, setQuality] = useState(0.9);
  const [loadingIds, setLoadingIds] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [shareError, setShareError] = useState("");
  const [isLimitFiles, setIsLimitFiles] = useState(() =>
    Math.max(maxFilesTotal - files.length, 0),
  );
  const fileRef = useRef();
  const { skipPreview, lowMemory, concurrencyLimit } =
    detectMobileConstraints();
  const shareAvailable = canShareFiles();
  console.log(
    "Math.max(maxFilesTotal - files.length, 0)",
    Math.max(maxFilesTotal - files.length, 0),
  );

  function handleFiles(list) {
    const selectedFiles = Array.from(list || []);
    const remainingSlots = Math.max(maxFilesTotal - files.length, 0);

    if (remainingSlots === 0) {
      setUploadError(`You can keep up to ${maxFilesTotal} files in the list.`);
      try {
        if (fileRef.current) fileRef.current.value = "";
      } catch (e) {}
      return;
    }

    const trimmedSelectedFiles = selectedFiles.slice(0, remainingSlots);
    const skippedForLimit = selectedFiles.length - trimmedSelectedFiles.length;

    const supportedFiles = trimmedSelectedFiles.filter((f) =>
      isSupportedImageFile(f),
    );
    const invalidFiles = trimmedSelectedFiles.filter(
      (f) => !isSupportedImageFile(f),
    );
    const invalidCount = invalidFiles.length;
    const messages = [];

    if (invalidCount > 0) {
      const invalidFormats = [...new Set(invalidFiles.map(getFileFormatLabel))];
      const invalidFormatsText = invalidFormats.join(", ");
      messages.push(
        invalidCount === trimmedSelectedFiles.length
          ? `Unsupported format: ${invalidFormatsText}. Please choose HEIC, HEIF, or JPEG files only.`
          : `${invalidCount} file(s) skipped. Unsupported format(s): ${invalidFormatsText}. Only HEIC, HEIF, and JPEG are supported.`,
      );
    }

    if (skippedForLimit > 0) {
      messages.push(
        `${skippedForLimit} file(s) skipped. You can keep up to ${maxFilesTotal} files in the list.`,
      );
    }

    setUploadError(messages.join(" "));

    if (supportedFiles.length === 0) return;
    const mapped = supportedFiles.map((f) => ({
      file: f,
      preview: isJpegFile(f) ? URL.createObjectURL(f) : null,
      convertedBlob: null,
      convertedUrl: null,
      convertedName: null,
      status: "idle",
      error: null,
    }));
    setFiles((prev) => [...mapped, ...prev]);

    if (!skipPreview) {
      // Generate previews after enqueueing files so fast formats like JPEG
      // update mounted items, while HEIC previews run one-by-one to reduce jank.
      setTimeout(() => {
        const previewTasks = mapped.map(
          (item, i) => () => generatePreview(item.file, i),
        );
        runWithConcurrency(previewTasks, 1);
      }, 0);
    }

    try {
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {}
  }

  async function generatePreview(file, idx, q = 0.2) {
    try {
      if (isJpegFile(file)) {
        const url = URL.createObjectURL(file);
        setFiles((prev) =>
          prev.map((it, i) =>
            i === idx ? { ...it, preview: url, status: "idle" } : it,
          ),
        );
        return;
      }

      setFiles((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, status: "preview" } : it)),
      );
      const blob = await convertHeicToJpeg(file, q, 10000);
      const outBlob =
        blob instanceof Blob ? blob : new Blob([blob], { type: "image/jpeg" });
      const url = URL.createObjectURL(outBlob);
      setFiles((prev) =>
        prev.map((it, i) =>
          i === idx ? { ...it, preview: url, status: "idle" } : it,
        ),
      );
    } catch (e) {
      console.warn("[Preview] Skipped for", file.name, "—", e.message);
      setFiles((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, status: "idle" } : it)),
      );
    }
  }

  async function convertItem(idx) {
    const item = files[idx];
    if (!item) return;
    setLoadingIds((s) => [...s, idx]);
    setFiles((prev) =>
      prev.map((it, i) =>
        i === idx ? { ...it, status: "converting", error: null } : it,
      ),
    );
    try {
      const startTime = performance.now();
      const blob = isJpegFile(item.file)
        ? item.file
        : await convertHeicToJpeg(item.file, quality, 60000); // 60s timeout for main conversion
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      console.log(
        `[Convert] Success in ${duration}s. Output: ${(blob.size / 1024).toFixed(2)} KB`,
      );

      const outBlob =
        blob instanceof Blob ? blob : new Blob([blob], { type: "image/jpeg" });
      const url = URL.createObjectURL(outBlob);
      const convertedName = item.file.name.replace(
        /\.(heic|heif|jpe?g)$/i,
        ".jpg",
      );

      // revoke low-quality preview (if any) to save memory
      try {
        if (item.preview) URL.revokeObjectURL(item.preview);
      } catch (e) {}

      setFiles((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                convertedBlob: outBlob,
                convertedUrl: url,
                convertedName,
                status: "done",
              }
            : it,
        ),
      );
    } catch (e) {
      console.error(
        `[Convert] Failed for ${item.file.name}:`,
        e.code,
        e.message,
      );

      let userMsg = e.message;
      if (e.code === "TIMEOUT") {
        userMsg =
          "Timeout. HEIC may not be supported. Try Safari/iOS or Chrome/Android.";
      } else if (e.message?.includes("not a valid")) {
        userMsg = "File is corrupted or not HEIC.";
      } else if (!navigator.onLine) {
        userMsg = "No internet connection.";
      }

      setFiles((prev) =>
        prev.map((it, i) =>
          i === idx
            ? {
                ...it,
                status: "error",
                error: userMsg,
              }
            : it,
        ),
      );
    } finally {
      setLoadingIds((s) => s.filter((id) => id !== idx));
    }
  }

  async function convertAll() {
    // run conversions with limited concurrency
    const toConvert = files
      .map((f, i) => ({ f, i }))
      .filter((x) => !x.f.convertedBlob && x.f.status !== "converting");
    const tasks = toConvert.map((x) => () => convertItem(x.i));
    await runWithConcurrency(tasks, concurrencyLimit);
  }

  // helper to run async tasks with concurrency limit
  const runWithConcurrency = useCallback(async (tasks, limit = 2) => {
    let i = 0;
    const results = [];
    const workers = new Array(Math.min(limit, tasks.length))
      .fill(0)
      .map(async () => {
        while (i < tasks.length) {
          const cur = i++;
          try {
            results[cur] = await tasks[cur]();
          } catch (e) {
            results[cur] = e;
          }
        }
      });
    await Promise.all(workers);
    return results;
  }, []);

  async function downloadZip() {
    const zip = new JSZip();
    const usedNames = new Set();
    for (const it of files) {
      if (it.convertedBlob) {
        const fileName = makeUniqueFileName(
          it.convertedName ||
            it.file.name.replace(/\.(heic|heif|jpe?g)$/i, ".jpg"),
          usedNames,
        );
        zip.file(fileName, it.convertedBlob);
      }
    }
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = "heic-converted.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function shareItem(idx) {
    const item = files[idx];
    if (!item?.convertedBlob || !shareAvailable) return;

    try {
      setShareError("");
      const sharedFile = new File(
        [item.convertedBlob],
        item.convertedName ||
          item.file.name.replace(/\.(heic|heif|jpe?g)$/i, ".jpg"),
        { type: "image/jpeg" },
      );

      await navigator.share({
        files: [sharedFile],
        title: sharedFile.name,
        text: "Converted with HEIC to JPG Converter",
        url: window.location.href,
      });
    } catch (e) {
      if (e?.name === "AbortError") return;
      setShareError("Sharing failed. Please try again or use Download.");
    }
  }

  function clearAll() {
    files.forEach((item) => {
      try {
        if (item.preview) URL.revokeObjectURL(item.preview);
      } catch (e) {}
      try {
        if (item.convertedUrl) URL.revokeObjectURL(item.convertedUrl);
      } catch (e) {}
    });

    setFiles([]);
    setLoadingIds([]);
    setUploadError("");
    setShareError("");

    try {
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {}
  }

  function removeItem(idx) {
    const removed = files[idx];
    if (removed) {
      try {
        if (removed.preview) URL.revokeObjectURL(removed.preview);
      } catch (e) {}
      try {
        if (removed.convertedUrl) URL.revokeObjectURL(removed.convertedUrl);
      } catch (e) {}
    }
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    setIsLimitFiles(Math.max(maxFilesTotal - files.length, 0));
  }, [files.length]);

  return (
    <div className="bg-white/60 glass p-6 rounded-lg neumorph max-w-4xl mx-auto">
      <ProgressBar files={files} />
      {uploadError && (
        <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {uploadError}
        </div>
      )}
      {shareError && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {shareError}
        </div>
      )}
      <div className="grid gap-4">
        <DropZone
          filesCount={files.length}
          isLimitFiles={isLimitFiles}
          lowMemory={lowMemory}
          onDrop={handleFiles}
          onDragOver={() => setDragActive(true)}
          onDragLeave={() => setDragActive(false)}
          onClick={() => fileRef.current.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current.click();
          }}
          fileInputRef={fileRef}
          onFileInputChange={handleFiles}
        />
        {files.length > 0 ? (
          <ConversionControls
            files={files}
            quality={quality}
            onQualityChange={setQuality}
            onConvertAll={convertAll}
            onDownloadZip={downloadZip}
            onClearAll={clearAll}
          />
        ) : null}

        <div className="grid gap-4">
          {files.length === 0 && (
            <div className="text-sm text-center text-slate-500">
              No files added yet.
            </div>
          )}
          {files.map((it, idx) => (
            <FileItem
              key={idx}
              item={it}
              idx={idx}
              isLoading={loadingIds.includes(idx)}
              shareAvailable={shareAvailable}
              onConvert={convertItem}
              onShare={shareItem}
              onRemove={removeItem}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
