import { useEffect, useId, useState } from 'react';
import { disableReminder, enableReminder, getReminderStatus, type ReminderStatus } from '../lib/native/reminder';
import {
  DEFAULT_REMINDER_TIME,
  REMINDER_BODY,
  describeTime,
  formatTime,
  parseTime,
} from '../lib/native/reminderLogic';

type Message = { kind: 'ok' | 'error'; text: string };

/**
 * Optional gentle daily reminder. Only appears inside the phone app (the website cannot send
 * these), and is OFF until the person switches it on. The phone's permission question is asked
 * only after the person has read our own explanation and tapped Continue.
 *
 * Mount anywhere in the Settings page as <ReminderSetting />. It draws its own card and renders
 * nothing at all on the website, so no wrapper or isNative() check is needed.
 */
export default function ReminderSetting() {
  const headingId = useId();
  const timeId = useId();
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [explaining, setExplaining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let alive = true;
    void getReminderStatus().then((s) => {
      if (!alive) return;
      setStatus(s);
      if (s.time) setTime(formatTime(s.time));
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!status || !status.supported) return null;

  const parsed = parseTime(time);
  const on = status.state === 'on';

  async function refresh() {
    const s = await getReminderStatus();
    setStatus(s);
    if (s.time) setTime(formatTime(s.time));
  }

  async function turnOn() {
    if (!parsed) {
      setMessage({ kind: 'error', text: 'Please choose a time for the reminder.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const result = await enableReminder(parsed);
    setExplaining(false);
    await refresh();
    setBusy(false);
    if (result === 'enabled') {
      setMessage({ kind: 'ok', text: `Reminder is on. You will get one quiet nudge each day at ${describeTime(parsed)}.` });
    } else if (result === 'denied') {
      setMessage({
        kind: 'error',
        text: 'Notifications are turned off for this app, so no reminder was set. You can allow them in your phone’s Settings, then come back here.',
      });
    } else {
      setMessage({ kind: 'error', text: 'Sorry, the reminder could not be set. Please try again.' });
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    const ok = await disableReminder();
    await refresh();
    setBusy(false);
    setMessage(ok ? { kind: 'ok', text: 'Reminder is off.' } : { kind: 'error', text: 'Sorry, the reminder could not be turned off. Please try again.' });
  }

  async function changeTime(next: string) {
    setTime(next);
    const t = parseTime(next);
    if (!on || !t) return;
    setBusy(true);
    setMessage(null);
    const result = await enableReminder(t);
    await refresh();
    setBusy(false);
    setMessage(
      result === 'enabled'
        ? { kind: 'ok', text: `Reminder moved to ${describeTime(t)}.` }
        : { kind: 'error', text: 'Sorry, the new time could not be saved. Please try again.' },
    );
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 max-w-md rounded-lg border border-line bg-white p-6">
      <h2 id={headingId} className="font-display text-xl font-bold">
        A gentle daily reminder
      </h2>
      <p className="mt-2 text-sm text-spruce-soft">
        One quiet notification a day, at the time you choose. It says only: “{REMINDER_BODY}”. It never mentions
        your health information, and you can turn it off at any time.
      </p>

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="font-semibold">{on ? 'Reminder is on' : 'Reminder is off'}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={headingId}
          disabled={busy}
          onClick={() => {
            setMessage(null);
            if (on) void turnOff();
            else setExplaining(true);
          }}
          className={`relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-line transition-colors disabled:opacity-60 ${
            on ? 'bg-spruce' : 'bg-mist'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-7 w-7 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
              on ? 'translate-x-8' : 'translate-x-1'
            }`}
          />
          <span className="sr-only">{on ? 'Turn reminder off' : 'Turn reminder on'}</span>
        </button>
      </div>

      {(on || explaining) && (
        <div className="mt-4">
          <label htmlFor={timeId} className="block text-sm font-semibold">
            Time of day
          </label>
          <input
            id={timeId}
            type="time"
            value={time}
            onChange={(e) => void changeTime(e.target.value)}
            disabled={busy}
            className="mt-1 w-40 rounded-md border border-line bg-white px-3 py-2 text-lg"
          />
        </div>
      )}

      {explaining && !on && (
        <div role="group" aria-label="Before your phone asks" className="mt-4 rounded-md border border-line bg-mist p-4">
          <p className="font-semibold">Before your phone asks</p>
          <p className="mt-1 text-sm">
            Your phone is about to ask whether Build Your Pillars may send you notifications. We use that
            permission for this one daily reminder only. No adverts, no news, nothing else. If you say no,
            the app works exactly the same.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={busy || !parsed}
              className="rounded-md bg-spruce px-4 py-2 font-semibold text-mist hover:bg-spruce-soft disabled:opacity-60"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={() => setExplaining(false)}
              disabled={busy}
              className="rounded-md border border-line bg-white px-4 py-2 font-semibold"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {status.state === 'blocked' && !explaining && (
        <p role="status" className="mt-3 text-sm">
          Notifications are turned off for this app in your phone’s Settings. If you would like the reminder, allow
          notifications there first.
        </p>
      )}
      {status.state === 'needs-permission' && (
        <p role="alert" className="mt-3 text-sm text-alert">
          A reminder was set, but notifications are now turned off in your phone’s Settings, so it cannot appear.
        </p>
      )}

      {message?.kind === 'ok' && (
        <p role="status" className="mt-3 text-sm">
          {message.text}
        </p>
      )}
      {message?.kind === 'error' && (
        <p role="alert" className="mt-3 text-sm text-alert">
          {message.text}
        </p>
      )}
    </section>
  );
}
