// A tiny publish/subscribe hub: crimes, mission beats and sound cues travel through it so
// systems never need to import each other just to say that something happened.

const listeners = new Map();

export function on(type, handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(handler);
  return () => listeners.get(type).delete(handler);
}

export function emit(type, payload) {
  const set = listeners.get(type);
  if (!set) return;
  for (const handler of set) handler(payload);
}

export function clearAllListeners() {
  listeners.clear();
}
