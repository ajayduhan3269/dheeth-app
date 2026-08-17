import React, { useState, useEffect } from 'react';
import { sounds } from '../utils/sound';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already running standalone as an installed PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check iOS vs Android / Chromium
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isMobile = /android|iphone|ipad|ipod|mobile/i.test(userAgent);

    if (isIosDevice) {
      setIsIOS(true);
      const timer = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(timer);
    }

    // Android / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Fallback: If on mobile browser and event didn't fire immediately, show banner after 2s
    let fallbackTimer = null;
    if (isMobile) {
      fallbackTimer = setTimeout(() => {
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, []);

  if (!visible) return null;

  const handleInstallClick = async () => {
    sounds.click();

    if (isIOS) {
      setShowGuide(true);
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        sounds.success?.();
        setVisible(false);
      }
      setDeferredPrompt(null);
    } else {
      // Show Android installation instruction guide
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setShowGuide(false);
  };

  return (
    <>
      {/* Floating Install Prompt Banner - Appears on every browser session */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40 animate-slide-up">
        <div className="bg-gradient-to-r from-dh-card via-dh-surface to-dh-card border-2 border-dh-accent/60 rounded-2xl p-3.5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-dh-accent/20 border border-dh-accent/50 flex items-center justify-center text-xl flex-shrink-0 animate-pulse">
              📲
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-heading font-black text-white truncate">
                Install DHEETH App
              </h4>
              <p className="text-[10px] text-dh-text-muted truncate">
                Get full-screen speed & instant match alerts!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="py-2 px-3.5 rounded-xl bg-dh-accent hover:bg-dh-accent/90 text-slate-950 font-heading font-black text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(0,230,118,0.4)] active:scale-95"
            >
              Install ⚡
            </button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-lg text-dh-text-muted hover:text-white flex items-center justify-center text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Installation Guide Modal (iOS & Android Fallback) */}
      {showGuide && (
        <div className="fixed inset-0 z-[999] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-dh-card border-2 border-dh-accent/40 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <div className="text-4xl mb-3">📲</div>
            <h3 className="text-lg font-heading font-black text-white mb-2">
              Install DHEETH on {isIOS ? 'iPhone / Safari' : 'Android / Chrome'}
            </h3>
            <p className="text-xs text-dh-text-muted mb-4">
              Install to your home screen for the full app experience:
            </p>

            <div className="bg-dh-surface border border-dh-border rounded-2xl p-4 text-left space-y-3 mb-5 text-xs text-slate-100">
              {isIOS ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">1️⃣</span>
                    <span>Tap the <strong className="text-dh-accent">Share button</strong> (⎋) in Safari's menu.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">2️⃣</span>
                    <span>Scroll down and tap <strong className="text-dh-accent">"Add to Home Screen"</strong> (➕).</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">3️⃣</span>
                    <span>Tap <strong className="text-dh-accent">"Add"</strong> in the top right corner!</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">1️⃣</span>
                    <span>Tap the <strong className="text-dh-accent">Three Dots Menu</strong> (⋮) in Chrome's top right corner.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">2️⃣</span>
                    <span>Tap <strong className="text-dh-accent">"Install app"</strong> or <strong className="text-dh-accent">"Add to Home screen"</strong>.</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg">3️⃣</span>
                    <span>Confirm by tapping <strong className="text-dh-accent">"Install"</strong>!</span>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-3 rounded-xl bg-dh-accent text-slate-950 font-heading font-black text-xs uppercase tracking-wide shadow-md active:scale-95"
            >
              Got it 👍
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PWAInstallPrompt;
