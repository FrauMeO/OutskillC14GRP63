import { useEffect, useState } from 'react';
import { detectInstallPlatform, installHint } from '../lib/installHint';

// `beforeinstallprompt` is not in lib.dom.d.ts.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const buttonClass =
  'inline-flex min-h-12 items-center justify-center rounded-md bg-spruce px-6 py-3 font-semibold text-mist transition-colors hover:bg-spruce-soft';

// Installs the app where the browser allows it; otherwise shows a plain-words hint for this browser.
export default function InstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    function onPrompt(e: Event) {
      e.preventDefault(); // hold the browser's own banner until the person taps our button
      setPromptEvent(e as InstallPromptEvent);
    }
    const onInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (window.matchMedia?.('(display-mode: standalone)').matches) setInstalled(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return setShowHint(true);
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome === 'accepted') setInstalled(true);
  }

  if (installed) {
    return (
      <p role="status" className="font-semibold">
        Build Your Pillars is installed on this device.
      </p>
    );
  }

  const hint = installHint(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints));

  return (
    <div>
      <button type="button" onClick={install} className={buttonClass} aria-expanded={promptEvent ? undefined : showHint}>
        {promptEvent ? 'Install on this device' : 'Show me how to install'}
      </button>
      {showHint && (
        <p role="status" className="mt-4 max-w-xl rounded-md border border-line bg-white px-4 py-3">
          {hint}
        </p>
      )}
    </div>
  );
}
