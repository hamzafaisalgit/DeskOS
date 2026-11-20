import { useCallback, useEffect, useRef, useState } from "react";
import { useLaunchData } from "../../core/launch";
import { useDesk } from "../../core/store";
import { registerCloseGuard } from "../../core/documents/guards";
import { FocusPanel } from "../../components/Overlays";
export function useDirtyGuard(dirty: boolean, save: () => Promise<void>) {
  const { windowId } = useLaunchData();
  const [pending, setPending] = useState<null | (() => void)>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(() => {
    if (!dirty || !windowId) return;
    const unregister = registerCloseGuard(windowId, () => {
      setPending(() => () => {
        unregister();
        useDesk.getState().close(windowId);
      });
    });
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", before);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", before);
    };
  }, [dirty, windowId]);
  const request = useCallback(
    (action: () => void) => {
      if (dirty) setPending(() => action);
      else action();
    },
    [dirty],
  );
  const dialog = pending ? (
    <FocusPanel
      close={() => {
        if (!busy) setPending(null);
      }}
      className="file-dialog"
    >
      <h2>Save your changes?</h2>
      <p>
        Your original file is safe. Unsaved edits will be lost if discarded.
      </p>
      {error && <p role="alert">{error}</p>}
      <footer>
        <button disabled={busy} onClick={() => setPending(null)}>
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={() => {
            pending();
            setPending(null);
          }}
        >
          Discard
        </button>
        <button
          className="primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await saveRef.current();
              pending();
              setPending(null);
            } catch (e) {
              setError(String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Save and continue
        </button>
      </footer>
    </FocusPanel>
  ) : null;
  return { request, dialog };
}
