import { useState } from "react";
import { FocusPanel } from "../../components/Overlays";
import type { Entry } from "../../core/filesystem/types";
export type FileDialog = {
  title: string;
  label?: string;
  initial?: string;
  destinations?: Entry[];
  confirm?: string;
  run: (value: string) => Promise<unknown>;
};
export function OperationDialog({
  dialog,
  close,
}: {
  dialog: FileDialog;
  close: () => void;
}) {
  const [value, setValue] = useState(dialog.initial ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <FocusPanel
      close={() => {
        if (!busy) close();
      }}
      className="file-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await dialog.run(value);
            close();
          } catch (e) {
            setError(String(e));
            setBusy(false);
          }
        }}
      >
        <small>FILES / DESKOS</small>
        <h2>{dialog.title}</h2>
        {dialog.label && (
          <label>
            {dialog.label}
            {dialog.destinations ? (
              <select
                aria-label={dialog.label}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              >
                {dialog.destinations.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} · {e.id === "home" ? "Home" : e.id.slice(0, 6)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={dialog.label}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
              />
            )}
          </label>
        )}
        {dialog.confirm && <p>{dialog.confirm}</p>}
        {error && (
          <p role="alert" className="file-alert">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
          <button className="primary" disabled={busy} type="submit">
            {busy ? "Working…" : "Confirm"}
          </button>
        </footer>
      </form>
    </FocusPanel>
  );
}
