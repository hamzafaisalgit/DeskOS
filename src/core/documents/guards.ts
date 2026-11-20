const guards = new Map<string, () => void>();
export function registerCloseGuard(id: string, guard: () => void) {
  guards.set(id, guard);
  return () => {
    guards.delete(id);
  };
}
export function interceptClose(id: string) {
  const guard = guards.get(id);
  if (guard) {
    guard();
    return true;
  }
  return false;
}

export const hasDirtyWindows = () => guards.size > 0;
