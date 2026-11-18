import { useEffect, useState } from "react";
import { liveQuery } from "dexie";
import { filesystem } from "./service";
import type { Entry } from "./types";
export function useFilesystem() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let stopped = false;
    let subscription:
      ReturnType<ReturnType<typeof liveQuery>["subscribe"]> | undefined;
    filesystem
      .initialize()
      .then(() => {
        if (stopped) return;
        subscription = liveQuery(() => filesystem.all()).subscribe({
          next: (rows) => {
            setEntries(rows);
            setLoading(false);
            setError("");
          },
          error: (e) => {
            setError(String(e));
            setLoading(false);
          },
        });
      })
      .catch((e) => {
        if (!stopped) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      stopped = true;
      subscription?.unsubscribe();
    };
  }, [retry]);
  return { entries, error, loading, retry: () => setRetry((n) => n + 1) };
}
