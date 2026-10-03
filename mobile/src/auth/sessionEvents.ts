// Tiny event channel so the API client can tell the session that the token was refused
// (401 unauthorized) without importing React code.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized(): void {
  listeners.forEach((listener) => listener());
}
