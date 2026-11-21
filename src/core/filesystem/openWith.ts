import { useDesk } from "../store";
import { apps } from "../registry";
import type { AppId } from "../registry";
import type { Entry } from "./types";
import { fileHandler } from "./associations";
function builtInHandlers(e: Entry): AppId[] {
  if (e.kind !== "file") return [];
  if (e.extension === "deskcanvas") return ["canvas"];
  const handler = fileHandler(e);
  if (handler === "audio") return ["music"];
  if (handler === "video") return ["cinema"];
  if (handler === "image")
    return e.extension === "gif" ? ["photos"] : ["photos", "canvas"];
  if (handler === "pdf") return ["pdf"];
  if (handler === "text")
    return /^(md|txt|markdown)$/.test(e.extension)
      ? ["notes", "code"]
      : ["code"];
  return [];
}
export function compatibleApps(e: Entry): AppId[] {
  return [
    ...builtInHandlers(e),
    ...apps
      .filter(
        (a) =>
          a.source === "package" && a.supportedFileTypes.includes(e.extension),
      )
      .map((a) => a.id),
  ];
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
