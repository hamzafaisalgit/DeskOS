export let persistencePaused = false;
export const setPersistencePaused = (value: boolean) => {
  persistencePaused = value;
};
export let storageProblem = "";
export function readStorage(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(`deskos.v1.${key}`) ?? "null");
  } catch {
    storageProblem = "Some saved data could not be read. Defaults were used.";
    return null;
  }
}
export function writeStorage(key: string, value: unknown) {
  if (persistencePaused) return false;
  try {
    localStorage.setItem(`deskos.v1.${key}`, JSON.stringify(value));
    return true;
  } catch {
    storageProblem =
      "Browser storage is unavailable or full. Changes may not survive a reload.";
    if (typeof window !== "undefined")
      window.dispatchEvent(new Event("deskos-storage-error"));
    return false;
  }
}
