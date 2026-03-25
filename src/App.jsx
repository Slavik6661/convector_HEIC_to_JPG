import React, { useEffect, useState } from "react";
import Converter from "./components/Converter";
import AdComponent from "./components/AdComponent";
import CookieBanner from "./components/CookieBanner";
import { Helmet } from "react-helmet-async";

const COOKIE_CONSENT_KEY = "cookie-consent-v1";

export default function App() {
  const [cookieConsent, setCookieConsent] = useState(null);

  useEffect(() => {
    try {
      const savedConsent = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (savedConsent === "accepted" || savedConsent === "declined") {
        setCookieConsent(savedConsent);
      }
    } catch (e) {
      setCookieConsent(null);
    }
  }, []);

  const adsenseClient = import.meta.env.VITE_ADSENSE_CLIENT;
  const gaMeasurementId = import.meta.env.VITE_GA_MEASUREMENT_ID;
  const consentAccepted = cookieConsent === "accepted";

  function updateCookieConsent(value) {
    setCookieConsent(value);
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, value);
    } catch (e) {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 p-4 sm:p-6 text-slate-100">
      <Helmet>
        <title>HEIC to JPG Converter - Free Online Tool | Drag & Drop</title>
        <meta
          name="description"
          content="Fast and free HEIC to JPG converter. No upload servers, all conversion happens in your browser. 100% private. Supports drag-and-drop on any device."
        />
        <script type="application/ld+json">{`{
          "@context":"https://schema.org",
          "@type":"WebApplication",
          "name":"HEIC to JPG Converter",
          "description":"Fast and private client-side HEIC to JPG converter.",
          "applicationCategory":"ImageProcessing",
          "operatingSystem":"All",
          "url":"/"
        }`}</script>
        {consentAccepted && adsenseClient && (
          <script
            async
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          />
        )}
        {consentAccepted && gaMeasurementId && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
            />
            <script>{`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaMeasurementId}', { anonymize_ip: true });
            `}</script>
          </>
        )}
      </Helmet>

      <header className="max-w-4xl mx-auto mb-6 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">HEIC to JPG Converter</h1>
          <p className="text-sm text-slate-300">
            Files never leave your browser - private & free
          </p>
        </div>
        <div className="mt-4">
          <AdComponent position="header" adsEnabled={consentAccepted} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        <Converter />
      </main>

      <footer className="max-w-4xl mx-auto mt-8 text-center text-sm text-slate-400">
        <div className="mb-4">
          <AdComponent position="footer" adsEnabled={consentAccepted} />
        </div>
        <div>
          Copyright {new Date().getFullYear()} HEIC to JPG - All conversion
          happens in your browser.
        </div>
      </footer>

      {cookieConsent === null && (
        <CookieBanner
          onAccept={() => updateCookieConsent("accepted")}
          onDecline={() => updateCookieConsent("declined")}
        />
      )}
    </div>
  );
}
