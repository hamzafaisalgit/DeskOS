import { useEffect, useState } from "react";
import { useFilesystem } from "../../core/filesystem/hooks";
import { formatBytes } from "../../core/filesystem/types";
import { useDesk } from "../../core/store";
export function StorageSettings() {
  const { entries, loading, error } = useFilesystem();
  const [estimate, setEstimate] = useState<StorageEstimate>();
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(setEstimate)
      .catch(() => {});
  }, [entries]);
  const files = entries.filter((e) => e.kind === "file");
  const groups = Object.entries(
    files.reduce<Record<string, number>>((r, e) => {
      const type = e.mime.split("/")[0] || "other";
      r[type] = (r[type] ?? 0) + e.size;
      return r;
    }, {}),
  );
  return (
    <>
      <p className="muted">
        Files stay in this browser's storage. This is not your computer's
        physical disk. Clearing site data removes virtual files; export
        important folders regularly.
      </p>
      {loading && <p>Reading storage…</p>}
      {error && <p role="alert">{error}</p>}
      <div className="setting-row">
        Virtual file contents
        <strong>{formatBytes(files.reduce((n, e) => n + e.size, 0))}</strong>
      </div>
      <div className="setting-row">
        Browser estimated usage
        <strong>
          {estimate?.usage !== undefined
            ? formatBytes(estimate.usage)
            : "Unavailable"}
        </strong>
      </div>
      <div className="setting-row">
        Browser storage quota
        <strong>
          {estimate?.quota !== undefined
            ? formatBytes(estimate.quota)
            : "Unavailable"}
        </strong>
      </div>
      {estimate?.quota && (estimate.usage ?? 0) / estimate.quota > 0.85 && (
        <p role="alert">
          Storage is running low. Export files before cleaning up Trash.
        </p>
      )}
      <div className="setting-row">
        Files / folders
        <span>
          {files.length} /{" "}
          {entries.filter((e) => e.kind === "directory").length}
        </span>
      </div>
      <h3>File type distribution</h3>
      <div className="storage-distribution">
        {groups.map(([type, size]) => (
          <div key={type}>
            <span>{type}</span>
            <span>{formatBytes(size)}</span>
          </div>
        ))}
        {!groups.length && <p>No files stored yet.</p>}
      </div>
      <h3>Largest files</h3>
      <div className="storage-distribution">
        {[...files]
          .sort((a, b) => b.size - a.size)
          .slice(0, 5)
          .map((e) => (
            <div key={e.id}>
              <span>
                {e.name}
                {e.trashed ? " · Trash" : ""}
              </span>
              <span>{formatBytes(e.size)}</span>
            </div>
          ))}
      </div>
      <div className="setting-row">
        Trash contents
        <span>
          {formatBytes(
            files.filter((e) => e.trashed).reduce((n, e) => n + e.size, 0),
          )}
        </span>
        <button onClick={() => useDesk.getState().open("files", "trash")}>
          Review Trash
        </button>
      </div>
      <button
        className="primary"
        onClick={() => useDesk.getState().open("files")}
      >
        Open Files to export
      </button>
    </>
  );
}
