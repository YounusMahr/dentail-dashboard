'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, MoreVertical, Share2, X } from 'lucide-react';

const INSTALLED_KEY = 'dentalcare-pwa-installed';
const DISMISSED_KEY = 'dentalcare-pwa-dismissed';

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export default function PwaInstallPrompt({ visible }) {
  const installEvent = useRef(null);
  const [mode, setMode] = useState('hidden');
  const [expanded, setExpanded] = useState(false);
  const [platform, setPlatform] = useState('desktop');

  useEffect(() => {
    const agent = navigator.userAgent;
    setPlatform(/iPad|iPhone|iPod/.test(agent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 ? 'ios' : /Android/.test(agent) ? 'android' : 'desktop');
    const displayMode = window.matchMedia('(display-mode: standalone)');
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch {}

    function onBeforeInstallPrompt(event) {
      event.preventDefault();
      installEvent.current = event;
      try { localStorage.removeItem(INSTALLED_KEY); } catch {}
      if (!dismissed && !isStandalone()) setMode('prompt');
    }
    function onInstalled() {
      installEvent.current = null;
      setMode('hidden');
      setExpanded(false);
      try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
    }
    function onDisplayModeChange() {
      if (isStandalone()) onInstalled();
      else if (installEvent.current && !dismissed) setMode('prompt');
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener?.('change', onDisplayModeChange);
    if ('serviceWorker' in navigator && (window.isSecureContext || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(registration => registration.update()).catch(() => {});
    }

    const fallback = window.setTimeout(() => {
      let alreadyInstalled = false;
      try { alreadyInstalled = localStorage.getItem(INSTALLED_KEY) === '1'; } catch {}
      if (!dismissed && !isStandalone() && !alreadyInstalled && !installEvent.current) setMode('manual');
    }, 1500);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  async function install() {
    if (!installEvent.current) { setExpanded(value => !value); return; }
    const event = installEvent.current;
    installEvent.current = null;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice?.outcome === 'accepted') {
        setMode('hidden');
        try { localStorage.setItem(INSTALLED_KEY, '1'); } catch {}
      } else {
        setMode('manual');
        setExpanded(true);
      }
    } catch {
      setMode('manual');
      setExpanded(true);
    }
  }

  function dismiss() {
    setMode('hidden');
    setExpanded(false);
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch {}
  }

  if (!visible || mode === 'hidden') return null;
  return <aside className="pwa-install" aria-label="Install DentalCare">
    {expanded && <div className="pwa-install-help">
      <strong>Use DentalCare like an app</strong>
      {platform === 'ios' ? <p>Tap <Share2 size={15} aria-label="Share" /> Share in Safari, then choose <b>Add to Home Screen</b>.</p> : platform === 'android' ? <p>Open the browser menu <MoreVertical size={15} aria-label="Menu" /> and choose <b>Install app</b> or <b>Add to Home screen</b>.</p> : <p>Use the install icon in your browser address bar, or open the browser menu and choose <b>Install DentalCare</b>.</p>}
      <small>Your clinic records still require an internet connection.</small>
    </div>}
    <div className="pwa-install-bar"><span className="pwa-install-icon"><Download size={20}/></span><span className="pwa-install-copy"><strong>DentalCare on your device</strong><small>Fast access to your clinic workspace</small></span><button className="pwa-install-action" onClick={install}>{mode === 'prompt' ? 'Install app' : 'How to install'}</button><button className="pwa-install-close" onClick={dismiss} aria-label="Dismiss install suggestion"><X size={16}/></button></div>
  </aside>;
}
