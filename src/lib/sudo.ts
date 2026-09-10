/**
 * Sudo Mode - Seamless Transient Authorization Window
 *
 * Modeled after Kylrix's sudo-mode:
 * Keeps an in-memory timestamp for sensitive actions (revealing nsec, key export, wiping DB).
 * Auto-expires after 5 minutes without persisting sensitive secrets to disk.
 */

export const SUDO_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
let lastSudoTimestamp = 0;

export const markSudoActive = () => {
  lastSudoTimestamp = Date.now();
};

export const resetSudo = () => {
  lastSudoTimestamp = 0;
};

export const isSudoActive = () => {
  return Date.now() - lastSudoTimestamp < SUDO_WINDOW_MS;
};
