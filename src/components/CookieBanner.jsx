import React from "react";

export default function CookieBanner({ onAccept, onDecline }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6">
      <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/95 p-4 text-slate-100 shadow-2xl backdrop-blur">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-white">
              Cookie consent
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              We use cookies and similar technologies to enable ads and
              analytics after you give consent. Essential site functionality
              continues to work even if you decline.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDecline}
              className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-400 hover:text-white"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              Accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
