export type Entry = {
  id: string;
  parentId: string | null;
  name: string;
  kind: "file" | "directory";
  mime: string;
  extension: string;
  size: number;
  created: number;
  modified: number;
  accessed?: number;
  trashed: boolean;
  trashRoot?: string;
  originalParent?: string | null;
  favorite: boolean;
  protected: boolean;
  position?: { x: number; y: number };
};
export type Content = { id: string; blob: Blob };
export const HOME = "home";
export const folders = [
  "Desktop",
  "Documents",
  "Downloads",
  "Pictures",
  "Music",
  "Videos",
  "Projects",
];
export const folderId = (name: string) => `system-${name.toLowerCase()}`;
export const formatBytes = (n: number) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
export function validateName(name: string) {
  if (
    !name.trim() ||
    name !== name.trim() ||
    name.length > 180 ||
    /[\\/]/.test(name) ||
    [...name].some((c) => c.charCodeAt(0) < 32) ||
    name === "." ||
    name === ".."
  )
    throw Error(
      "Use a name of 1–180 characters without slashes or control characters.",
    );
  return name;
}
export const mimeFor = (name: string) =>
  ({
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    csv: "text/csv",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    pdf: "application/pdf",
    mp3: "audio/mpeg",
    wav: "audio/wav",
    mp4: "video/mp4",
    webm: "video/webm",
  })[name.split(".").at(-1)!.toLowerCase()] ?? "application/octet-stream";
