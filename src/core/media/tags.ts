import { create } from "zustand";
import { readStorage, writeStorage } from "../storage";
import { filesystem as fs } from "../filesystem/service";
import type { Entry } from "../filesystem/types";
export type Tags = {
  revision: number;
  title: string;
  artist: string;
  album: string;
};
const saved = readStorage("music-tags");
export const useTags = create<{
  tracks: Record<string, Tags>;
  put: (id: string, t: Tags) => void;
}>((set, get) => ({
  tracks:
    saved && typeof saved === "object"
      ? Object.fromEntries(
          Object.entries(saved).filter(
            ([, t]) =>
              t &&
              typeof t.title === "string" &&
              typeof t.artist === "string" &&
              typeof t.album === "string" &&
              typeof t.revision === "number",
          ),
        )
      : {},
  put: (id, t) => {
    const tracks = { ...get().tracks, [id]: t };
    set({ tracks });
    writeStorage("music-tags", tracks);
  },
}));
export async function readTags(entry: Entry, artwork = false) {
  const { parseBlob } = await import("music-metadata");
  const result = await parseBlob(await fs.getFileContent(entry.id), {
    skipCovers: !artwork,
    duration: false,
  });
  const tags = {
    revision: entry.revision ?? 0,
    title: result.common.title || entry.name,
    artist: result.common.artist || "",
    album: result.common.album || "",
  };
  useTags.getState().put(entry.id, tags);
  const cover = result.common.picture?.[0];
  return cover
    ? new Blob([new Uint8Array(cover.data)], { type: cover.format })
    : null;
}
