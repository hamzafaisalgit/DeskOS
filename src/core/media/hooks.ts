import { useEffect, useState } from "react";
import { filesystem as fs } from "../filesystem/service";
import type { Entry } from "../filesystem/types";
import { useLaunchData } from "../launch";
import { useDesk } from "../store";
export function useMediaUrl(entry?: Entry) {
  const [state, setState] = useState({
    id: "",
    revision: 0,
    url: "",
    error: "",
  });
  const id = entry?.trashed ? undefined : entry?.id,
    revision = entry?.revision;
  useEffect(() => {
    let alive = true,
      url = "";
    if (!id) return;
    fs.getFileContent(id)
      .then((blob) => {
        if (alive) {
          url = URL.createObjectURL(blob);
          setState({ id, revision: revision ?? 0, url, error: "" });
        }
      })
      .catch((e) => {
        if (alive)
          setState({ id, revision: revision ?? 0, url: "", error: String(e) });
      });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, revision]);
  return id === state.id && (revision ?? 0) === state.revision
    ? state
    : { url: "", error: "" };
}
export function useActiveFile() {
  const launch = useLaunchData();
  const [id, setId] = useState(launch.entryId || "");
  useEffect(() => {
    if (launch.entryId) {
      const timer = setTimeout(() => setId(launch.entryId!), 0);
      return () => clearTimeout(timer);
    }
  }, [launch.entryId]);
  const select = (id: string) => {
    setId(id);
    if (launch.windowId)
      useDesk.setState((s) => ({
        windows: s.windows.map((w) =>
          w.id === launch.windowId ? { ...w, entryId: id } : w,
        ),
      }));
  };
  return [id, select] as const;
}
export function report(error: unknown) {
  useDesk.getState().notify(String(error), "error");
}
