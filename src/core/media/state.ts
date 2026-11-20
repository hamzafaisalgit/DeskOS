import { create } from "zustand";
import { readStorage, writeStorage } from "../storage";
export type Collection = {
  id: string;
  kind: "music" | "photos" | "cinema";
  name: string;
  files: string[];
};
export type Progress = { position: number; duration: number; opened: number };
export type Bookmark = { page: number; name: string };
type Data = {
  collections: Collection[];
  progress: Record<string, Progress>;
  bookmarks: Record<string, Bookmark[]>;
  preferences: Record<string, number | string | boolean>;
};
const raw = readStorage("media") as Partial<Data> | null;
const initial: Data = {
  collections: Array.isArray(raw?.collections)
    ? raw.collections.filter(
        (c) =>
          c &&
          typeof c.id === "string" &&
          typeof c.name === "string" &&
          ["music", "photos", "cinema"].includes(c.kind) &&
          Array.isArray(c.files) &&
          c.files.every((f) => typeof f === "string"),
      )
    : [],
  progress:
    raw?.progress && typeof raw.progress === "object"
      ? Object.fromEntries(
          Object.entries(raw.progress).filter(
            ([, p]) =>
              p &&
              Number.isFinite(p.position) &&
              Number.isFinite(p.duration) &&
              Number.isFinite(p.opened),
          ),
        )
      : {},
  bookmarks:
    raw?.bookmarks && typeof raw.bookmarks === "object"
      ? Object.fromEntries(
          Object.entries(raw.bookmarks).filter(
            ([, b]) =>
              Array.isArray(b) &&
              b.every(
                (x) =>
                  x &&
                  Number.isInteger(x.page) &&
                  x.page > 0 &&
                  typeof x.name === "string",
              ),
          ),
        )
      : {},
  preferences:
    raw?.preferences && typeof raw.preferences === "object"
      ? raw.preferences
      : {},
};
export const useMediaState = create<
  Data & {
    collection: (c: Collection) => void;
    removeCollection: (id: string) => void;
    progressFor: (id: string, value: Progress) => void;
    bookmark: (id: string, value: Bookmark[]) => void;
    preference: (key: string, value: number | string | boolean) => void;
  }
>((set, get) => {
  const persist = (patch: Partial<Data>) => {
    set(patch);
    const { collections, progress, bookmarks, preferences } = get();
    writeStorage("media", { collections, progress, bookmarks, preferences });
  };
  return {
    ...initial,
    collection: (c) =>
      persist({
        collections: [...get().collections.filter((x) => x.id !== c.id), c],
      }),
    removeCollection: (id) =>
      persist({ collections: get().collections.filter((c) => c.id !== id) }),
    progressFor: (id, p) =>
      persist({ progress: { ...get().progress, [id]: p } }),
    bookmark: (id, b) =>
      persist({ bookmarks: { ...get().bookmarks, [id]: b } }),
    preference: (key, value) =>
      persist({ preferences: { ...get().preferences, [key]: value } }),
  };
});
export const clock = (n: number) =>
  !Number.isFinite(n)
    ? "0:00"
    : Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");
export const editableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  !!target.closest("input,textarea,select,[contenteditable=true]");
