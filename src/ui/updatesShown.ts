// Whether TF2 update markers show on the Trends and queue charts and the Activity calendar. One choice for the whole
// dashboard, off by default and remembered, like the mute setting in sound.ts.
const storageKey = "tf2viz-updates";
let shown = localStorage.getItem(storageKey) === "1";
const listeners = new Set<() => void>();

export const isUpdatesShown = () => shown;

// Shaped for useSyncExternalStore, so every panel that draws markers re-renders when the toggle changes.
export function subscribeUpdates(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setUpdatesShown(value: boolean): void {
  shown = value;
  localStorage.setItem(storageKey, shown ? "1" : "0");
  for (const listener of listeners) listener();
}
