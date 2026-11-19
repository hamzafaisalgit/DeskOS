import { useEffect, useState } from "react";
import {
  FileText,
  Folder,
  Image,
  Music,
  Film,
  File,
  X,
  Download,
  Save,
} from "lucide-react";
import type { Entry } from "../../core/filesystem/types";
import { formatBytes } from "../../core/filesystem/types";
import { fileHandler } from "../../core/filesystem/associations";
import { filesystem } from "../../core/filesystem/service";
import { exportFiles } from "../../core/filesystem/transfers";
import { FocusPanel } from "../../components/Overlays";
export function FileIcon({
  entry,
  size = 32,
}: {
  entry: Entry;
  size?: number;
}) {
  const Icon =
    entry.kind === "directory"
      ? Folder
      : {
          text: FileText,
          image: Image,
          audio: Music,
          video: Film,
          pdf: FileText,
          download: File,
        }[fileHandler(entry)];
  return (
    <Icon
      size={size}
      strokeWidth={1.4}
      className={entry.kind === "directory" ? "folder-symbol" : "file-symbol"}
    />
  );
}
export function FilePreview({
  entry,
  close,
}: {
  entry: Entry;
  close: () => void;
}) {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [original, setOriginal] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(entry.revision ?? 0);
  const [dimensions, setDimensions] = useState("");
  const [saving, setSaving] = useState(false);
  const handler = fileHandler(entry);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    (handler === "text"
      ? filesystem.readDocument(entry.id)
      : filesystem
          .getFileContent(entry.id)
          .then((blob) => ({ entry: { revision: 0 }, blob }))
    )
      .then(async ({ entry: snapshot, blob }) => {
        if (handler === "text") {
          if (blob.size > 2 * 1024 * 1024)
            throw Error(
              "Text preview is limited to 2 MB. Export this file to open it externally.",
            );
          let value = await blob.text();
          if (entry.extension === "json") {
            try {
              value = JSON.stringify(JSON.parse(value), null, 2);
            } catch {
              /* Preserve invalid JSON as text. */
            }
          }
          if (active) {
            setVersion(snapshot.revision ?? 0);
            setText(value);
            setOriginal(value);
          }
        } else {
          objectUrl = URL.createObjectURL(blob);
          if (active) setUrl(objectUrl);
        }
        if (active) setLoading(false);
        await filesystem.touch(entry.id);
      })
      .catch((e) => {
        if (active) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry.id, entry.extension, handler]);
  const [confirmClose, setConfirmClose] = useState(false);
  const requestClose = () => {
    if (text !== original) setConfirmClose(true);
    else close();
  };
  return (
    <FocusPanel close={requestClose} className="file-preview">
      <header>
        <FileIcon entry={entry} size={22} />
        <div>
          <strong>{entry.name}</strong>
          <small>
            {formatBytes(entry.size)} · {entry.mime || "File"} {dimensions}
          </small>
        </div>
        <button
          aria-label="Export file"
          onClick={() =>
            exportFiles([entry.id]).catch((e) => setError(String(e)))
          }
        >
          <Download size={18} />
        </button>
        <button aria-label="Close preview" onClick={requestClose}>
          <X size={18} />
        </button>
      </header>
      {confirmClose && (
        <div className="file-alert">
          Discard unsaved edits?<button onClick={close}>Discard</button>
          <button onClick={() => setConfirmClose(false)}>Keep editing</button>
        </div>
      )}
      {error && (
        <div className="file-alert" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="empty">Loading preview…</div>
      ) : (
        <div className="preview-body">
          {handler === "text" && !error && (
            <>
              <textarea
                aria-label="File text"
                spellCheck={false}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                className="primary"
                disabled={saving || text === original}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const saved = await filesystem.saveDocument(
                      entry.id,
                      text,
                      version,
                    );
                    setVersion(saved.revision ?? 0);
                    setOriginal(text);
                  } catch (e) {
                    setError(String(e));
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <Save size={16} />
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
          {handler === "image" && url && (
            <img
              src={url}
              alt={entry.name}
              onLoad={(e) =>
                setDimensions(
                  `· ${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`,
                )
              }
              onError={() =>
                setError(
                  "This image could not be decoded. Export it to open externally.",
                )
              }
            />
          )}
          {handler === "pdf" && url && (
            <object data={url} type="application/pdf" aria-label={entry.name}>
              <p>
                Your browser cannot preview this PDF. Use Export to download it.
              </p>
            </object>
          )}
          {handler === "audio" && url && (
            <audio
              controls
              src={url}
              onError={() =>
                setError("This audio format is not supported by your browser.")
              }
            />
          )}
          {handler === "video" && url && (
            <video
              controls
              src={url}
              onError={() =>
                setError("This video format is not supported by your browser.")
              }
            />
          )}
          {handler === "download" && (
            <div className="empty">
              <FileIcon entry={entry} size={60} />
              <h2>Ready to take with you.</h2>
              <p>
                No preview is available for this format.
                <br />
                Export it to open in an application on your computer.
              </p>
              <button
                onClick={() =>
                  exportFiles([entry.id]).catch((e) => setError(String(e)))
                }
              >
                Export file
              </button>
            </div>
          )}
        </div>
      )}
    </FocusPanel>
  );
}
