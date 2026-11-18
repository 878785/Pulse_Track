/**
 * Browser persistence for presentation preferences only.
 * Health records are persisted by the Flask API in SQLite.
 */

const KEYS = {
  theme: 'pulsetrack.theme.v1',
  settings: 'pulsetrack.settings.v1',
};

function safeParse(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) ?? fallback;
  } catch (error) {
    console.warn('[PulseTrack] Could not parse saved preferences:', error);
    return fallback;
  }
}

export const Storage = {
  saveTheme(theme) {
    localStorage.setItem(KEYS.theme, JSON.stringify({ theme }));
  },

  loadTheme() {
    const data = safeParse(localStorage.getItem(KEYS.theme), null);
    return data?.theme ?? 'dark';
  },

  saveSettings(settings) {
    localStorage.setItem(KEYS.settings, JSON.stringify(settings));
  },

  loadSettings() {
    return safeParse(localStorage.getItem(KEYS.settings), {});
  },
};

export default Storage;
