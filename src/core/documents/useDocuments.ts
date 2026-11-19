import { useCallback, useEffect, useRef, useState } from "react";
import { useLaunchData } from "../launch";
import { useDesk } from "../store";
import { liveQuery } from "dexie";
import { filesystem as fs } from "../filesystem/service";
import type { Entry } from "../filesystem/types";
export type DocumentTab = {
  id: string;
  entry: Entry;
  text: string;
  saved: string;
  revision: number;
  external: boolean;
  missing: boolean;
};
export function useDocuments() {
  const launch = useLaunchData();
  const [tabs, setTabs] = useState<DocumentTab[]>([]);
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  const tabsRef = useRef(tabs);
  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);
  const open = useCallback(
    async (id: string) => {
      try {
        if (!tabsRef.current.some((t) => t.id === id)) {
          const { entry, blob } = await fs.readDocument(id);
          const text = await blob.text();
          setTabs((t) =>
            t.some((d) => d.id === id)
              ? t
              : [
                  ...t,
                  {
                    id,
                    entry,
                    text,
                    saved: text,
                    revision: entry.revision ?? 0,
                    external: false,
                    missing: false,
                  },
                ],
          );
          await fs.touch(id);
        }
        setActive(id);
        if (launch.windowId)
          useDesk.setState((s) => ({
            windows: s.windows.map((w) =>
              w.id === launch.windowId ? { ...w, entryId: id } : w,
            ),
          }));
      } catch (e) {
        setError(String(e));
      }
    },
    [launch.windowId],
  );
  useEffect(() => {
    const sub = liveQuery(() => fs.all()).subscribe((rows) => {
      setTabs((tabs) =>
        tabs.map((t) => {
          const entry = rows.find((e) => e.id === t.id);
          return !entry || entry.trashed
            ? { ...t, missing: true }
            : {
                ...t,
                entry,
                missing: false,
                external: (entry.revision ?? 0) !== t.revision,
              };
        }),
      );
    });
    return () => sub.unsubscribe();
  }, []);
  const edit = (text: string) =>
    setTabs((t) => t.map((d) => (d.id === active ? { ...d, text } : d)));
  const save = async (id = active) => {
    const tab = tabsRef.current.find((t) => t.id === id);
    if (!tab) return;
    const snapshot = tab.text;
    const entry = await fs.saveDocument(id, snapshot, tab.revision);
    setTabs((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              entry,
              saved: snapshot,
              revision: entry.revision ?? 0,
              external: false,
            }
          : t,
      ),
    );
  };
  const reload = async (id = active) => {
    const { entry, blob } = await fs.readDocument(id);
    const text = await blob.text();
    setTabs((ts) =>
      ts.map((t) =>
        t.id === id
          ? {
              ...t,
              entry,
              text,
              saved: text,
              revision: entry.revision ?? 0,
              external: false,
              missing: false,
            }
          : t,
      ),
    );
  };
  const close = (id: string) => {
    setTabs((ts) => ts.filter((t) => t.id !== id));
    setActive(tabsRef.current.find((t) => t.id !== id)?.id ?? "");
  };
  return {
    tabs,
    active,
    setActive,
    open,
    edit,
    save,
    reload,
    close,
    error,
    setError,
    current: tabs.find((t) => t.id === active),
  };
}
