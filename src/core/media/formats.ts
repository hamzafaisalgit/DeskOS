import type { Entry } from "../filesystem/types";
export type MediaKind = "music" | "photos" | "cinema" | "pdf";
export function matches(e: Entry, kind: MediaKind) {
  if (e.trashed || e.kind !== "file") return false;
  return kind === "music"
    ? /^(mp3|wav|ogg|m4a|aac|flac)$/.test(e.extension) ||
        e.mime.startsWith("audio/")
    : kind === "photos"
      ? /^(png|jpe?g|webp|gif)$/.test(e.extension)
      : kind === "cinema"
        ? /^(mp4|webm|ogv)$/.test(e.extension) || e.mime.startsWith("video/")
        : e.extension === "pdf";
}
