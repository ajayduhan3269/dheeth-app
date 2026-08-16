import React, { useState, useEffect } from 'react';
import { sounds } from '../utils/sound';

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already installed / running standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem('dheeth_pwa_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // Android / Chromium beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    if (isIosDevice && !isStandalone) {
      setIsIOS(true);
      // Show prompt after a short delay on iOS
      const timer = setTimeout(() => setVisible(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!visible) return null;

  const handleInstallClick = async () => {
    sounds.click();
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      sounds.success?.();
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem('dheeth_pwa_dismissed', Date.now().toString());
    setVisible(false);
    setShowIOSGuide(false);
  };

  return (
    <>
      {/* Floating Install Prompt Banner */}
      <div className="fixed bottom-24 left-4 right-4 max-w-md mx-auto z-40 animate-slide-up">
        <div className="bg-gradient-to-r from-dh-card via-dh-surface to-dh-card border-2 border-dh-accent/40 rounded-2xl p-3.5 shadow-2xl backdrop-blur-lg flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-dh-accent/20 border border-dh-accent/40 flex items-center justify-center text-xl flex-shrink-0">
              ⚡
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-heading font-black text-white truncate">
                Install DHEETH Arena
              </h4>
              <p className="text-[10px] text-dh-text-muted truncate">
                Instant match alerts & full-screen app experience!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="py-2 px-3.5 rounded-xl bg-dh-accent hover:bg-dh-accent/90 text-black font-heading font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-95"
            >
              Install 📲
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

      {/* iOS Add to Home Screen Sheet */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in">
          <div className="bg-dh-card border-4 border-dh-border rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <div className="text-4xl mb-3">📱</div>
            <h3 className="text-lg font-heading font-black text-white mb-2">
              Install DHEETH on iPhone / iPad
            </h3>
            <p className="text-xs text-dh-text-muted mb-4">
              To install the web app on your home screen:
            </p>

            <div className="bg-dh-surface border border-dh-border rounded-2xl p-4 text-left space-y-3 mb-5 text-xs">
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
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-3 rounded-xl bg-dh-accent text-black font-heading font-black text-xs uppercase tracking-wide"
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
