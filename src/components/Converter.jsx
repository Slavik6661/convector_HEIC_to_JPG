import React, { useState, useRef, useCallback } from "react";
import heic2any from "heic2any";
import { HeifFile } from "libheif-js";
import JSZip from "jszip";

function bytesToKB(n) {
  return (n / 1024).toFixed(2);
}

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
  const [files, setFiles] = useState([]); // {file, preview, convertedBlob, convertedUrl, status, error}
  const [quality, setQuality] = useState(0.9);
  const [loadingIds, setLoadingIds] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [shareError, setShareError] = useState("");
  const fileRef = useRef();
  const { skipPreview, lowMemory, concurrencyLimit } =
    detectMobileConstraints();
  const shareAvailable = canShareFiles();

  function handleFiles(list) {
    const selectedFiles = Array.from(list || []);
    const supportedFiles = selectedFiles.filter((f) => isSupportedImageFile(f));
    const invalidFiles = selectedFiles.filter((f) => !isSupportedImageFile(f));
    const invalidCount = invalidFiles.length;

    if (invalidCount > 0) {
      const invalidFormats = [...new Set(invalidFiles.map(getFileFormatLabel))];
      const invalidFormatsText = invalidFormats.join(", ");
      setUploadError(
        invalidCount === selectedFiles.length
          ? `Unsupported format: ${invalidFormatsText}. Please choose HEIC, HEIF, or JPEG files only.`
          : `${invalidCount} file(s) skipped. Unsupported format(s): ${invalidFormatsText}. Only HEIC, HEIF, and JPEG are supported.`,
      );
    } else {
      setUploadError("");
    }

    if (supportedFiles.length === 0) return;
    const mapped = supportedFiles.map((f) => ({
      file: f,
      preview: null, // will be generated (heic not directly displayable in many browsers)
      convertedBlob: null,
      convertedUrl: null,
      convertedName: null,
      status: "idle",
      error: null,
    }));
    setFiles((prev) => [...mapped, ...prev]);

    if (!skipPreview) {
      // Run preview creation after enqueueing files so fast formats like JPEG
      // update the already-mounted items instead of racing the state insert.
      setTimeout(() => {
        mapped.forEach((item, i) => {
          generatePreview(item.file, i);
        });
      }, 0);
    }

    try {
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {}
  }

  async function generatePreview(file, idx, q = 0.35) {
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
    for (const it of files) {
      if (it.convertedBlob) {
        zip.file(
          it.convertedName ||
            it.file.name.replace(/\.(heic|heif|jpe?g)$/i, ".jpg"),
          it.convertedBlob,
        );
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

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e) {
    e.preventDefault();
    setDragActive(true);
    e.dataTransfer.dropEffect = "copy";
  }
  function onDragLeave(e) {
    e.preventDefault();
    setDragActive(false);
  }

  return (
    <div className="bg-white/60 glass p-6 rounded-lg neumorph max-w-4xl mx-auto">
      {/* Global progress */}
      {files.length > 0 && (
        <div className="mb-4">
          <div className="text-sm text-slate-600 mb-1">Conversion progress</div>
          <div className="w-full bg-slate-100 rounded h-3 overflow-hidden">
            <div
              className="h-3 bg-sky-500"
              style={{
                width: `${Math.round((files.filter((f) => f.status === "done").length / files.length) * 100)}%`,
              }}
            ></div>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {files.filter((f) => f.status === "converting").length} converting —{" "}
            {files.filter((f) => f.status === "done").length}/{files.length}{" "}
            done
          </div>
        </div>
      )}
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
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`border-2 border-dashed border-slate-200 py-8 px-4 sm:p-6 rounded cursor-pointer text-center hover:border-sky-300 transition ${dragActive ? "drop-active" : ""}`}
          onClick={() => fileRef.current.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current.click();
          }}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".heic,.heif,.jpg,.jpeg,image/heic,image/heif,image/jpeg"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="text-lg font-medium text-base sm:text-lg">
            Drag & Drop HEIC/HEIF/JPEG files here, or tap to select
          </div>
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
              onChange={(e) => {
                setQuality(parseFloat(e.target.value));
                const el = e.target;
                const min = parseFloat(el.min);
                const max = parseFloat(el.max);
                const val = ((parseFloat(el.value) - min) / (max - min)) * 100;
                el.style.setProperty("--range-val", `${val}%`);
              }}
              onInput={(e) => {
                const el = e.target;
                const min = parseFloat(el.min);
                const max = parseFloat(el.max);
                const val = ((parseFloat(el.value) - min) / (max - min)) * 100;
                el.style.setProperty("--range-val", `${val}%`);
              }}
            />
            <span className="text-sm w-12 text-right">
              {Math.round(quality * 100)}%
            </span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              className="w-full sm:w-auto px-4 py-3 bg-sky-600 text-white rounded text-center"
              onClick={convertAll}
            >
              Convert All
            </button>

            <button
              className="w-full sm:w-auto px-4 py-3 bg-emerald-500 text-white rounded flex items-center justify-center gap-2"
              onClick={downloadZip}
            >
              Download All as ZIP
            </button>

            <button
              className="w-full sm:w-auto px-4 py-3 bg-red-500 text-white rounded text-center"
              onClick={clearAll}
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="grid gap-4">
          {files.length === 0 && (
            <div className="text-sm text-slate-500">No files added yet.</div>
          )}
          {files.map((it, idx) => (
            <div
              key={idx}
              className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 border rounded"
            >
              <div className="w-full sm:w-48 h-44 sm:h-36 bg-slate-800 rounded overflow-hidden flex items-center justify-center">
                {it.convertedUrl || it.preview ? (
                  <img
                    src={it.convertedUrl || it.preview}
                    alt="preview"
                    className="object-contain w-full h-full"
                  />
                ) : (
                  <div role="status">
                    <svg
                      aria-hidden="true"
                      class="w-8 h-8 text-neutral-tertiary animate-spin fill-brand"
                      viewBox="0 0 100 101"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                        fill="currentColor"
                      />
                      <path
                        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                        fill="currentFill"
                      />
                    </svg>
                    <span class="sr-only">Loading...</span>
                  </div>
                )}
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between max-sm:gap-10">
                  <div>
                    <div className="font-medium">
                      {it.convertedName || it.file.name}
                    </div>
                    <div className="text-sm text-slate-500">
                      Original: {bytesToKB(it.file.size)} KB
                    </div>
                    {it.convertedBlob && (
                      <div className="text-sm text-slate-500">
                        Converted: {bytesToKB(it.convertedBlob.size)} KB
                      </div>
                    )}
                    {it.status === "error" && (
                      <div className="text-sm text-red-500">
                        Error: {it.error}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    {!it.convertedBlob && (
                      <button
                        onClick={() => convertItem(idx)}
                        className="w-full sm:w-auto px-3 py-2 bg-emerald-500 text-white rounded flex items-center justify-center gap-2"
                      >
                        {loadingIds.includes(idx) ? (
                          <>
                            <span className="spinner" />
                            <span className="font-semibold">Converting...</span>
                          </>
                        ) : (
                          "Convert"
                        )}
                      </button>
                    )}
                    {/* High-res preview removed per user request */}
                    {it.convertedBlob && (
                      <>
                        <a
                          className="w-full sm:w-auto px-3 py-2 bg-sky-600 text-white rounded text-center"
                          href={it.convertedUrl}
                          download={
                            it.convertedName ||
                            it.file.name.replace(
                              /\.(heic|heif|jpe?g)$/i,
                              ".jpg",
                            )
                          }
                        >
                          Download
                        </a>
                        {shareAvailable && (
                          <button
                            onClick={() => shareItem(idx)}
                            className="w-full sm:w-auto px-3 py-2 bg-violet-600 text-white rounded"
                          >
                            Share It
                          </button>
                        )}
                      </>
                    )}
                    <button
                      onClick={() => removeItem(idx)}
                      className="w-full sm:w-auto px-3 py-2 bg-red-500 text-white rounded"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
