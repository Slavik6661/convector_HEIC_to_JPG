import React, { useEffect } from "react";

const ADSENSE_SLOT_BY_POSITION = {
  header: import.meta.env.VITE_ADSENSE_SLOT_HEADER,
  footer: import.meta.env.VITE_ADSENSE_SLOT_FOOTER,
};

export default function AdComponent({
  position = "header",
  adsEnabled = false,
}) {
  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const adSlot = ADSENSE_SLOT_BY_POSITION[position];
  const canRenderAds = Boolean(adsEnabled && adsenseClient && adSlot);

  useEffect(() => {
    if (!canRenderAds || typeof window === "undefined") return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (e) {}
  }, [canRenderAds, adSlot]);

  return (
    <div className="w-full flex justify-center items-center py-2">
      <div className="w-full sm:w-3/4 bg-white/6 glass rounded-lg p-3 border border-white/6 text-center">
        <div className="text-xs text-slate-300 mb-2">Advertisement</div>
        <div className="min-h-16 sm:min-h-20 flex items-center justify-center bg-slate-800/60 rounded p-2">
          {canRenderAds ? (
            <ins
              className="adsbygoogle block w-full overflow-hidden rounded"
              style={{ minHeight: "64px" }}
              data-ad-client={adsenseClient}
              data-ad-slot={adSlot}
              data-ad-format="auto"
              data-full-width-responsive="true"
            />
          ) : adsEnabled ? (
            <div className="text-slate-400">
              Add `VITE_ADSENSE_CLIENT` and slot IDs to enable AdSense.
            </div>
          ) : (
            <div className="text-slate-400">
              Ads stay disabled until cookie consent is accepted.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
