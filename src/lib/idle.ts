// Runs the callback when the browser has spare time and returns a function that cancels it. Browsers without
// requestIdleCallback run it after a short timeout instead.
export function whenIdle(callback: () => void): () => void {
  if (window.requestIdleCallback) {
    const id = window.requestIdleCallback(callback);
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 1);
  return () => window.clearTimeout(id);
}
