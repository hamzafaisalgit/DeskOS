import { validatePlatform } from "../platform/package";
import { readStorage } from "../storage";
export const coverage = [
  {
    id: "applications",
    name: "Installed packages & app data",
    keys: ["platform.v1"],
    merge: false,
    dependencies: [],
    description:
      "Validated package resources, versions, app-owned data and lifecycle metadata. Restored apps are disabled; permission grants are removed.",
  },
  {
    id: "files",
    name: "Virtual files, folders & Trash",
    keys: [],
    merge: true,
    dependencies: [],
    description:
      "Binary content, saved documents/projects, metadata and favorites.",
  },
  {
    id: "preferences",
    name: "Appearance & system",
    keys: ["preferences"],
    merge: false,
    dependencies: [],
    description:
      "Desktop, theme, pinned apps, wallpaper references and window preferences.",
  },
  {
    id: "spaces",
    name: "Spaces & workspaces",
    keys: ["spaces.v1", "windows"],
    merge: false,
    dependencies: ["files"],
    description:
      "Spaces, ordering, snapshots, templates and eligible saved launch references.",
  },
  {
    id: "notes",
    name: "Legacy Notes",
    keys: ["notes"],
    merge: false,
    dependencies: [],
    description:
      "Original scratchpad records. New Notes files are in Virtual files.",
  },
  {
    id: "media",
    name: "Media collections & reading state",
    keys: ["media", "music-tags"],
    merge: false,
    dependencies: ["files"],
    description:
      "Playlists, albums, resume positions, PDF bookmarks, playback preferences and cached tags.",
  },
  {
    id: "calculator",
    name: "Calculator history",
    keys: ["calculator-history"],
    merge: false,
    dependencies: [],
    description: "Persisted calculations.",
  },
  {
    id: "editor",
    name: "Editor & Explorer preferences",
    keys: ["editor-font", "editor-wrap", "files-view", "files-details"],
    merge: false,
    dependencies: [],
    description: "Font, wrapping, file view and details settings.",
  },
  {
    id: "history-settings",
    name: "History retention",
    keys: ["history-count"],
    merge: false,
    dependencies: [],
    description:
      "Version retention preference. Historical blobs/restore points are local and excluded from Capsules.",
  },
] as const;
export const allowedKeys = coverage.flatMap((c) => [...c.keys]);
export function categoryValues(ids: string[]) {
  const result: Record<string, unknown> = {};
  for (const c of coverage.filter((c) => ids.includes(c.id)))
    for (const key of c.keys) {
      const value = readStorage(key);
      if (value !== null) result[key] = value;
    }
  return result;
}
export function validateSetting(key: string, v: unknown) {
  if (!allowedKeys.includes(key as never))
    throw Error("Unknown persistence category: " + key);
  const object = () => {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error("Invalid " + key);
  };
  if (["preferences", "spaces.v1", "media", "music-tags"].includes(key))
    object();
  if (
    ["notes", "calculator-history", "windows"].includes(key) &&
    !Array.isArray(v)
  )
    throw Error("Invalid " + key);
  if (key === "editor-font" && (typeof v !== "number" || v < 10 || v > 24))
    throw Error("Invalid editor font");
  if (["editor-wrap", "files-details"].includes(key) && typeof v !== "boolean")
    throw Error("Invalid boolean preference");
  if (key === "files-view" && !["grid", "list", "details"].includes(String(v)))
    throw Error("Invalid Explorer view");
  if (
    key === "history-count" &&
    (!Number.isInteger(v) || Number(v) < 1 || Number(v) > 30)
  )
    throw Error("Invalid history retention");
  if (
    key === "notes" &&
    !(v as unknown[]).every(
      (n) =>
        n &&
        typeof n === "object" &&
        ["id", "title", "text"].every(
          (k) => typeof (n as Record<string, unknown>)[k] === "string",
        ),
    )
  )
    throw Error("Invalid legacy note");
  if (key === "media") {
    const m = v as Record<string, unknown>;
    if (
      !Array.isArray(m.collections) ||
      !m.progress ||
      !m.bookmarks ||
      !m.preferences
    )
      throw Error("Invalid media metadata");
    for (const c of m.collections)
      if (
        !c ||
        typeof c.id !== "string" ||
        typeof c.name !== "string" ||
        !["music", "photos", "cinema"].includes(c.kind) ||
        !Array.isArray(c.files) ||
        !c.files.every((f: unknown) => typeof f === "string")
      )
        throw Error("Invalid media collection");
  }
  if (key === "spaces.v1") {
    const s = v as Record<string, unknown>;
    if (
      !Array.isArray(s.spaces) ||
      !s.spaces.length ||
      s.spaces.length > 24 ||
      !s.spaces.every(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.name === "string" &&
          Number.isInteger(x.wallpaper) &&
          x.wallpaper >= 0 &&
          x.wallpaper < 6,
      )
    )
      throw Error("Invalid Spaces");
  }
}

export function validateDeepSettings(key: string, v: unknown) {
  if (key === "platform.v1") {
    validatePlatform(v);
    return;
  }
  validateSetting(key, v);
  const value = v as Record<string, unknown>;
  if (
    key === "calculator-history" &&
    !(v as unknown[]).every(
      (x) =>
        x &&
        typeof x === "object" &&
        typeof (x as Record<string, unknown>).expression === "string" &&
        typeof (x as Record<string, unknown>).result === "string",
    )
  )
    throw Error("Invalid calculator history");
  if (key === "preferences") {
    if (
      value.theme !== undefined &&
      !["dark", "light", "system"].includes(String(value.theme))
    )
      throw Error("Invalid theme");
    if (
      value.wallpaper !== undefined &&
      (!Number.isInteger(value.wallpaper) ||
        Number(value.wallpaper) < 0 ||
        Number(value.wallpaper) > 5)
    )
      throw Error("Invalid wallpaper");
    if (
      value.accent !== undefined &&
      (typeof value.accent !== "string" ||
        !/^#[a-f0-9]{6}$/i.test(value.accent))
    )
      throw Error("Invalid accent");
  }
  if (key === "media") {
    for (const group of ["progress", "bookmarks", "preferences"]) {
      if (
        !value[group] ||
        typeof value[group] !== "object" ||
        Array.isArray(value[group])
      )
        throw Error("Invalid media " + group);
    }
    for (const p of Object.values(value.progress as object))
      if (
        !p ||
        !Number.isFinite(p.position) ||
        !Number.isFinite(p.duration) ||
        !Number.isFinite(p.opened)
      )
        throw Error("Invalid playback progress");
    for (const list of Object.values(value.bookmarks as object))
      if (
        !Array.isArray(list) ||
        !list.every(
          (b) =>
            b &&
            Number.isInteger(b.page) &&
            b.page > 0 &&
            typeof b.name === "string",
        )
      )
        throw Error("Invalid PDF bookmarks");
  }
  if (key === "music-tags")
    for (const t of Object.values(value))
      if (
        !t ||
        typeof t !== "object" ||
        !["title", "artist", "album"].every(
          (k) => typeof (t as Record<string, unknown>)[k] === "string",
        )
      )
        throw Error("Invalid audio metadata");
}
