import { useDesk } from "../store";
import type { Entry } from "./types";
import { fileHandler } from "./associations";
export function compatibleApps(e: Entry): ("notes" | "code")[] {
  if (e.kind !== "file" || fileHandler(e) !== "text") return [];
  return /^(md|txt|markdown)$/.test(e.extension) ? ["notes", "code"] : ["code"];
}
export function openDocument(e: Entry) {
  const app = compatibleApps(e)[0];
  if (!app) return false;
  useDesk.getState().open(app, e.id);
  return true;
}
export async function copyFilePath(path: string) {
  try {
    await navigator.clipboard.writeText(path);
    useDesk.getState().notify("File path copied");
  } catch {
    useDesk
      .getState()
      .notify(`Clipboard unavailable. Path: ${path}`, "warning");
  }
}
