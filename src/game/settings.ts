import { DEFAULT_SETTINGS, type Settings } from './types';
/** Browser storage is untrusted input: keep stale or malformed values out of the engine. */
export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const saved = value as Partial<Settings>;
  return {
    quality:
      saved.quality === 'eco' || saved.quality === 'ultra'
        ? saved.quality
        : 'balanced',
    camera: saved.camera === 'cockpit' ? 'cockpit' : 'chase',
    sound:
      typeof saved.sound === 'boolean' ? saved.sound : DEFAULT_SETTINGS.sound,
    assists:
      typeof saved.assists === 'boolean'
        ? saved.assists
        : DEFAULT_SETTINGS.assists,
  };
}
