// A page with unsaved changes (Log habits) registers here, so the main menu can ask before leaving.
let unsaved = false;

export function setUnsaved(value: boolean): void {
  unsaved = value;
}

export function confirmLeave(): boolean {
  return !unsaved || window.confirm('You have unsaved changes. Leave without saving them?');
}
