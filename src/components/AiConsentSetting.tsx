// Settings control for AI help. Reads and writes the same per-person consent as the dialog
// (src/lib/aiConsent.ts), so turning it off stops AI calls at once. Mount it in Settings next to
// the "Write my daily reflection automatically" switch. Turning it ON shows the same dialog first.
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AiConsentDialog from '../features/aiReflection/AiConsentDialog';
import { useAiConsent } from '../features/aiReflection/useAiConsent';

export default function AiConsentSetting() {
  const { user } = useAuth();
  const consent = useAiConsent(user?.id);
  const [asking, setAsking] = useState(false);
  const on = consent.allowed;

  function toggle() {
    if (on) consent.withdraw();
    else setAsking(true);
  }

  if (!user) return null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p id="ai-consent-label" className="text-lg font-semibold">
          Use AI help for reflections
        </p>
        <p id="ai-consent-hint" className="text-lg text-moss">
          {on
            ? 'On. Your logged words and numbers, and your goals, are sent to Claude (Anthropic, United States) when you ask for a reflection. Nothing is saved by us.'
            : 'Off. Nothing is sent to an AI. The rest of the app works the same.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby="ai-consent-label"
        aria-describedby="ai-consent-hint"
        onClick={toggle}
        className={`inline-flex min-h-11 min-w-16 shrink-0 items-center justify-center rounded-md border px-4 text-lg font-semibold ${
          on ? 'border-spruce bg-spruce text-mist' : 'border-spruce text-spruce hover:bg-mist'
        }`}
      >
        {on ? 'On' : 'Off'}
      </button>
      {asking && (
        <AiConsentDialog
          onYes={() => {
            consent.grant();
            setAsking(false);
          }}
          onNotNow={() => setAsking(false)}
        />
      )}
    </div>
  );
}
