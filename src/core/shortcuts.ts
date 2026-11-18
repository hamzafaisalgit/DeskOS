import { useEffect } from "react";
import { useDesk } from "./store";
export function useShortcuts(palette: () => void, dismiss: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const s = useDesk.getState();
      const modifier = e.ctrlKey || e.metaKey;
      if (modifier && e.key.toLowerCase() === "k") {
        e.preventDefault();
        palette();
      } else if (e.ctrlKey && e.altKey) {
        const app = { t: "terminal", n: "notes", s: "settings" }[
          e.key.toLowerCase()
        ] as "terminal" | "notes" | "settings" | undefined;
        if (app) {
          e.preventDefault();
          s.open(app);
        } else if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          s.showDesktop();
        }
      } else if (e.key === "Escape") dismiss();
      else if (e.altKey && e.key === "Tab") {
        const windows = s.windows.filter((w) => !w.minimized);
        if (windows.length) {
          e.preventDefault();
          const i = windows.findIndex((w) => w.id === s.active);
          s.focus(
            windows[
              (i + (e.shiftKey ? windows.length - 1 : 1)) % windows.length
            ].id,
          );
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [palette, dismiss]);
}
