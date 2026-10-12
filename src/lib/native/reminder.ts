// Native side of the daily reminder: talks to the phone's own notification system.
// The decisions live in reminderLogic.ts (tested). The plugin is loaded only on a real device.
//
// The phone's notification system is the only place the reminder is stored. We read it back with
// getPending(), so there is no copy of the person's chosen time in our database or in the browser.
import { isNative } from './platform';
import {
  REMINDER_ID,
  afterPermissionRequest,
  buildReminder,
  resolveState,
  type PermissionValue,
  type ReminderState,
  type ReminderTime,
} from './reminderLogic';

export type ReminderStatus = {
  /** False on the website: the reminder is an app-only feature. */
  supported: boolean;
  state: ReminderState;
  /** The time currently set, when a reminder is scheduled. */
  time: ReminderTime | null;
};

const UNSUPPORTED: ReminderStatus = { supported: false, state: 'off', time: null };

async function plugin() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  if (!isNative()) return UNSUPPORTED;
  try {
    const ln = await plugin();
    const [perm, pending] = await Promise.all([ln.checkPermissions(), ln.getPending()]);
    const mine = pending.notifications.find((n) => n.id === REMINDER_ID);
    const on = mine?.schedule?.on;
    const time =
      mine && typeof on?.hour === 'number' && typeof on?.minute === 'number'
        ? { hour: on.hour, minute: on.minute }
        : null;
    return {
      supported: true,
      state: resolveState(perm.display as PermissionValue, !!mine),
      time,
    };
  } catch {
    return UNSUPPORTED;
  }
}

/**
 * Turns the reminder on. Call this ONLY after the person has read our own explanation and tapped
 * Continue: it is the first place the phone's permission question can appear.
 */
export async function enableReminder(time: ReminderTime): Promise<'enabled' | 'denied' | 'error'> {
  if (!isNative()) return 'error';
  try {
    const ln = await plugin();
    let permission = (await ln.checkPermissions()).display as PermissionValue;
    if (permission === 'prompt' || permission === 'prompt-with-rationale') {
      permission = (await ln.requestPermissions()).display as PermissionValue;
    }
    if (afterPermissionRequest(permission) === 'denied') return 'denied';
    // Replace any earlier reminder so there is only ever one.
    await ln.cancel({ notifications: [{ id: REMINDER_ID }] });
    await ln.schedule({ notifications: [buildReminder(time)] });
    return 'enabled';
  } catch {
    return 'error';
  }
}

export async function disableReminder(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const ln = await plugin();
    await ln.cancel({ notifications: [{ id: REMINDER_ID }] });
    return true;
  } catch {
    return false;
  }
}
