import type { Entry } from "./types";
export type Handler = "text" | "image" | "pdf" | "audio" | "video" | "download";
export function fileHandler(e: Entry): Handler {
  if (
    /^(txt|md|json|csv|js|jsx|ts|tsx|css|html|xml|py|java|c|cpp|sh|yml|yaml|log)$/i.test(
      e.extension,
    ) ||
    e.mime.startsWith("text/")
  )
    return "text";
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(e.mime))
    return "image";
  if (e.mime === "application/pdf") return "pdf";
  if (e.mime.startsWith("audio/")) return "audio";
  if (e.mime.startsWith("video/")) return "video";
  return "download";
}
export const handlerName = (e: Entry) =>
  ({
    text: "Text viewer / editor",
    image: "Image preview",
    pdf: "PDF preview",
    audio: "Audio preview",
    video: "Video preview",
    download: "File details / download",
  })[fileHandler(e)];
