import { useEffect, useState } from "react";
import type { Entry } from "../../core/filesystem/types";
import { filesystem } from "../../core/filesystem/service";
import { FileIcon } from "./FilePreview";
export function FileThumbnail({ entry }: { entry: Entry }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
        entry.mime,
      ) ||
      entry.size > 10 * 1024 * 1024
    )
      return;
    let disposed = false;
    let value = "";
    filesystem
      .getFileContent(entry.id)
      .then((blob) => {
        if (disposed) return;
        value = URL.createObjectURL(blob);
        setUrl(value);
      })
      .catch(() => {});
    return () => {
      disposed = true;
      if (value) URL.revokeObjectURL(value);
    };
  }, [entry.id, entry.modified, entry.mime, entry.size]);
  return url ? (
    <img loading="lazy" className="file-thumbnail" src={url} alt="" />
  ) : (
    <FileIcon entry={entry} size={44} />
  );
}
