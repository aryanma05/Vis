// Åpner innstillingene (components/settings/SettingsDialog.tsx) fra hvor som helst.
export const OPEN_SETTINGS_EVENT = "vis:open-settings";

export function openSettings() {
  window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
}
