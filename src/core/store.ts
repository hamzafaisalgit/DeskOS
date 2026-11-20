import { DEFAULT_SPACE, validateSpaces, validateLayouts } from "./spaces/model";
import type { Space, WorkspaceLayout } from "./spaces/model";
import { filesystem } from "./filesystem/service";
import { interceptClose } from "./documents/guards";
import { create } from "zustand";
import { apps, appById } from "./registry";
import type { AppId } from "./registry";
import { readStorage, writeStorage } from "./storage";
export type Bounds = { x: number; y: number; width: number; height: number };
export type WindowState = Bounds & {
  id: string;
  appId: AppId;
  spaceId?: string;
  global?: boolean;
  entryId?: string;
  minimized: boolean;
  maximized: boolean;
  snapped?: boolean;
  previous?: Bounds;
};
export type Preferences = {
  theme: "dark" | "light" | "system";
  accent: string;
  wallpaper: number;
  transparent: boolean;
  reducedMotion: boolean;
  animations: boolean;
  snapping: boolean;
  restore: boolean;
  icons: boolean;
  dock: "floating" | "full";
  iconSize: number;
  hour24: boolean;
  pinned: AppId[];
  positions: Record<string, { x: number; y: number }>;
};
export const defaults: Preferences = {
  theme: "dark",
  accent: "#a49aff",
  wallpaper: 0,
  transparent: true,
  reducedMotion: false,
  animations: true,
  snapping: true,
  restore: true,
  icons: true,
  dock: "floating",
  iconSize: 42,
  hour24: false,
  pinned: ["files", "terminal", "notes", "calculator", "settings"],
  positions: {},
};
export const viewport = () => ({
  width: typeof window === "undefined" ? 1280 : window.innerWidth,
  height:
    typeof window === "undefined"
      ? 720
      : Math.max(180, window.innerHeight - 148),
});
export function constrain(b: Bounds): Bounds {
  const v = viewport();
  const width = Math.min(Math.max(260, b.width), v.width);
  const height = Math.min(Math.max(160, b.height), v.height);
  return {
    width,
    height,
    x: Math.max(0, Math.min(b.x, v.width - width)),
    y: Math.max(0, Math.min(b.y, v.height - height)),
  };
}
export function validatePreferences(value: unknown): Preferences {
  const p = {
    ...defaults,
    pinned: [...defaults.pinned],
    positions: {},
  } as Preferences;
  if (!value || typeof value !== "object") return p;
  const v = value as Record<string, unknown>;
  for (const key of [
    "transparent",
    "reducedMotion",
    "animations",
    "snapping",
    "restore",
    "icons",
    "hour24",
  ] as const)
    if (typeof v[key] === "boolean") p[key] = v[key];
  if (["dark", "light", "system"].includes(String(v.theme)))
    p.theme = v.theme as Preferences["theme"];
  if (typeof v.accent === "string" && /^#[\da-f]{6}$/i.test(v.accent))
    p.accent = v.accent;
  if (
    Number.isInteger(v.wallpaper) &&
    Number(v.wallpaper) >= 0 &&
    Number(v.wallpaper) < 6
  )
    p.wallpaper = Number(v.wallpaper);
  if (v.dock === "full" || v.dock === "floating") p.dock = v.dock;
  if (typeof v.iconSize === "number" && v.iconSize >= 32 && v.iconSize <= 56)
    p.iconSize = v.iconSize;
  if (Array.isArray(v.pinned))
    p.pinned = [
      ...new Set(
        v.pinned.filter((id): id is AppId => apps.some((a) => a.id === id)),
      ),
    ];
  if (v.positions && typeof v.positions === "object")
    for (const [id, pos] of Object.entries(v.positions))
      if (
        apps.some((a) => a.id === id) &&
        pos &&
        typeof pos === "object" &&
        "x" in pos &&
        "y" in pos &&
        typeof pos.x === "number" &&
        typeof pos.y === "number" &&
        Number.isFinite(pos.x) &&
        Number.isFinite(pos.y)
      )
        p.positions[id] = { x: pos.x, y: pos.y };
  return p;
}
const prefs = validatePreferences(readStorage("preferences"));
const saved = readStorage("windows");
export function restoreWindows(saved: unknown): WindowState[] {
  if (!Array.isArray(saved)) return [];
  const seen = new Set<string>();
  const single = new Set<AppId>();
  return saved
    .filter((w): w is WindowState => {
      if (
        !w ||
        typeof w !== "object" ||
        !apps.some((a) => a.id === w.appId) ||
        typeof w.id !== "string" ||
        seen.has(w.id) ||
        !["x", "y", "width", "height"].every(
          (k) => typeof w[k] === "number" && Number.isFinite(w[k]),
        )
      )
        return false;
      if (appById(w.appId).single && single.has(w.appId)) return false;
      seen.add(w.id);
      single.add(w.appId);
      return true;
    })
    .slice(0, 80)
    .map((w) => ({
      ...constrain(w),
      id: w.id,
      appId: w.appId,
      spaceId: typeof w.spaceId === "string" ? w.spaceId : DEFAULT_SPACE,
      entryId: typeof w.entryId === "string" ? w.entryId : undefined,
      maximized: Boolean(w.maximized),
      minimized: Boolean(w.minimized),
      snapped: Boolean(w.snapped),
      previous:
        w.previous &&
        Object.values(w.previous).length === 4 &&
        ["x", "y", "width", "height"].every(
          (k) =>
            typeof w.previous?.[k as keyof Bounds] === "number" &&
            Number.isFinite(w.previous[k as keyof Bounds]),
        )
          ? constrain(w.previous)
          : undefined,
    }));
}
const spaceSession = readStorage("spaces.v1") as {
  spaces?: unknown;
  activeSpace?: string;
  layouts?: unknown;
} | null;
const spaces = validateSpaces(spaceSession?.spaces, prefs.wallpaper);
const activeSpace = spaces.some((s) => s.id === spaceSession?.activeSpace)
  ? spaceSession!.activeSpace!
  : spaces[0].id;
const restored = (prefs.restore ? restoreWindows(saved) : []).map((w) => ({
  ...w,
  spaceId: spaces.some((s) => s.id === w.spaceId) ? w.spaceId : spaces[0].id,
}));
export type Notice = {
  id: string;
  text: string;
  kind: "info" | "success" | "warning" | "error";
  read: boolean;
  time: number;
};
type State = {
  spaces: Space[];
  activeSpace: string;
  layouts: WorkspaceLayout[];
  overview: boolean;
  createSpace: (name: string, wallpaper?: number) => string;
  renameSpace: (id: string, name: string) => void;
  deleteSpace: (id: string, target: string, closeWindows?: boolean) => void;
  reorderSpaces: (ids: string[]) => void;
  switchSpace: (id: string) => void;
  moveWindowToSpace: (id: string, space: string, follow?: boolean) => void;
  spaceAppearance: (
    id: string,
    patch: Partial<Pick<Space, "wallpaper" | "accent">>,
    all?: boolean,
  ) => void;
  arrange: (mode: "cascade" | "side" | "grid" | "center" | "bounds") => void;
  saveLayout: (name: string, kind: "snapshot" | "template") => void;
  editLayout: (id: string, name?: string, duplicate?: boolean) => void;
  restoreLayout: (
    id: string,
    mode: "layout" | "windows",
    newSpace?: boolean,
  ) => Promise<void>;

  prefs: Preferences;
  windows: WindowState[];
  active: string | null;
  recent: AppId[];
  notices: Notice[];
  hidden: string[];
  setPrefs: (p: Partial<Preferences>) => void;
  open: (id: AppId, entryId?: string) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  maximize: (id: string) => void;
  bounds: (id: string, b: Bounds) => void;
  snap: (
    id: string,
    side:
      | "left"
      | "right"
      | "top"
      | "bottom"
      | "top-left"
      | "top-right"
      | "bottom-left"
      | "bottom-right",
  ) => void;
  showDesktop: () => void;
  notify: (text: string, kind?: Notice["kind"]) => void;
  readNotices: () => void;
  clearNotices: () => void;
};
export const useDesk = create<State>((set, get) => ({
  spaces,
  activeSpace,
  layouts: validateLayouts(spaceSession?.layouts),
  overview: false,
  createSpace: (name, wallpaper) => {
    if (!name.trim()) throw Error("Enter a Space name.");
    if (get().spaces.length >= 24)
      throw Error("Up to 24 Spaces are supported.");
    const id = crypto.randomUUID();
    set((s) => ({
      spaces: [
        ...s.spaces,
        {
          id,
          name: name.trim().slice(0, 60),
          wallpaper: wallpaper ?? s.prefs.wallpaper,
          created: Date.now(),
          lastActive: Date.now(),
        },
      ],
    }));
    get().switchSpace(id);
    get().notify("Space created");
    return id;
  },
  renameSpace: (id, name) => {
    if (!name.trim()) throw Error("Enter a Space name.");
    set((s) => ({
      spaces: s.spaces.map((x) =>
        x.id === id ? { ...x, name: name.trim().slice(0, 60) } : x,
      ),
    }));
    get().notify("Space renamed");
  },
  switchSpace: (id) => {
    if (!get().spaces.some((s) => s.id === id)) return;
    set((s) => ({
      activeSpace: id,
      active:
        s.windows.findLast((w) => w.spaceId === id && !w.minimized)?.id ?? null,
      hidden: [],
      spaces: s.spaces.map((x) =>
        x.id === id ? { ...x, lastActive: Date.now() } : x,
      ),
    }));
  },
  reorderSpaces: (ids) => {
    const s = get();
    if (
      ids.length === s.spaces.length &&
      new Set(ids).size === ids.length &&
      ids.every((id) => s.spaces.some((x) => x.id === id))
    )
      set({ spaces: ids.map((id) => s.spaces.find((x) => x.id === id)!) });
  },
  moveWindowToSpace: (id, space, follow = false) => {
    if (!get().spaces.some((s) => s.id === space)) return;
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, spaceId: space } : w,
      ),
      active: s.active === id ? null : s.active,
    }));
    if (follow) get().focus(id);
    else get().switchSpace(get().activeSpace);
    get().notify("Window moved");
  },
  deleteSpace: (id, target, closeWindows = false) => {
    const s = get();
    if (
      s.spaces.length === 1 ||
      id === target ||
      !s.spaces.some((x) => x.id === target)
    )
      throw Error("Choose another Space to keep windows safe.");
    if (closeWindows) {
      const owned = s.windows.filter((w) => w.spaceId === id);
      for (const w of owned) {
        get().focus(w.id);
        get().close(w.id);
      }
      if (get().windows.some((w) => w.spaceId === id)) {
        get().notify(
          "Finish closing the remaining windows, then delete this Space again.",
          "warning",
        );
        return;
      }
    } else
      set((s) => ({
        windows: s.windows.map((w) =>
          w.spaceId === id ? { ...w, spaceId: target } : w,
        ),
      }));
    set((s) => ({ spaces: s.spaces.filter((x) => x.id !== id) }));
    get().switchSpace(s.activeSpace === id ? target : s.activeSpace);
    get().notify("Space deleted; files preserved");
  },
  spaceAppearance: (id, patch, all = false) =>
    set((s) => ({
      spaces: s.spaces.map((x) =>
        all || x.id === id ? { ...x, ...patch } : x,
      ),
    })),
  arrange: (mode) => {
    const s = get(),
      owned = s.windows.filter(
        (w) => w.spaceId === s.activeSpace && !w.minimized,
      ),
      v = viewport();
    const cols =
      mode === "side" ? owned.length : Math.ceil(Math.sqrt(owned.length));
    set({
      windows: s.windows.map((w) => {
        const i = owned.indexOf(w);
        if (i < 0) return w;
        let b: Bounds;
        if (mode === "bounds") b = constrain(w);
        else if (mode === "center") {
          if (w.id !== s.active) return w;
          b = {
            ...w,
            x: (v.width - w.width) / 2,
            y: (v.height - w.height) / 2,
          };
        } else if (mode === "cascade")
          b = {
            ...w,
            width: Math.min(w.width, v.width - 60),
            height: Math.min(w.height, v.height - 60),
            x: (i * 28) % 100,
            y: (i * 28) % 100,
          };
        else {
          const rows = mode === "side" ? 1 : Math.ceil(owned.length / cols);
          b = {
            x: ((i % cols) * v.width) / cols,
            y: (Math.floor(i / cols) * v.height) / rows,
            width: v.width / cols,
            height: v.height / rows,
          };
        }
        const app = appById(w.appId);
        b.width = Math.max(Math.min(app.minWidth, v.width), b.width);
        b.height = Math.max(Math.min(app.minHeight, v.height), b.height);
        return {
          ...w,
          ...constrain(b),
          previous: w.previous ?? {
            x: w.x,
            y: w.y,
            width: w.width,
            height: w.height,
          },
          maximized: false,
          snapped: true,
        };
      }),
    });
  },
  saveLayout: (name, kind) => {
    if (!name.trim()) throw Error("Enter a layout name.");
    const s = get(),
      space = s.spaces.find((x) => x.id === s.activeSpace)!;
    if (s.layouts.length >= 100)
      throw Error("Remove an old layout first (100 maximum).");
    set({
      layouts: [
        ...s.layouts,
        {
          id: crypto.randomUUID(),
          version: 1,
          kind,
          name: name.trim().slice(0, 60),
          created: Date.now(),
          wallpaper: space.wallpaper,
          windows: s.windows
            .filter((w) => w.spaceId === s.activeSpace)
            .map((w) => ({ ...w })),
          active: s.active ?? undefined,
        },
      ],
    });
    get().notify(kind === "template" ? "Template saved" : "Snapshot saved");
  },
  editLayout: (id, name, duplicate = false) => {
    const l = get().layouts.find((l) => l.id === id);
    if (!l) return;
    if (name !== undefined && !name.trim()) throw Error("Enter a name.");
    set((s) => ({
      layouts: duplicate
        ? [
            ...s.layouts,
            { ...l, id: crypto.randomUUID(), name: name || l.name + " copy" },
          ]
        : name === undefined
          ? s.layouts.filter((l) => l.id !== id)
          : s.layouts.map((l) =>
              l.id === id ? { ...l, name: name.trim() } : l,
            ),
    }));
  },
  restoreLayout: async (id, mode, newSpace = false) => {
    const l = get().layouts.find((l) => l.id === id);
    if (!l) return;
    const target = newSpace
      ? get().createSpace(l.name, l.wallpaper)
      : get().activeSpace;
    const used = new Set<string>();
    let missing = 0;
    for (const item of l.windows) {
      let entryId = item.entryId;
      if (entryId) {
        try {
          await filesystem.initialize();
          const e = await filesystem.getEntry(entryId);
          if (e.trashed) throw Error("Trashed");
        } catch {
          entryId = undefined;
          missing++;
        }
      }
      let w = get().windows.find(
        (w) =>
          w.spaceId === target &&
          !used.has(w.id) &&
          (w.id === item.id ||
            (w.appId === item.appId && w.entryId === entryId)),
      );
      if (!w && mode === "windows") {
        const single = appById(item.appId).single;
        const elsewhere = get().windows.find((w) => w.appId === item.appId);
        if (single && elsewhere) {
          missing++;
          continue;
        }
        get().switchSpace(target);
        get().open(item.appId, entryId);
        w = get().windows.find((w) => w.id === get().active);
      }
      if (w) {
        used.add(w.id);
        const wid = w.id;
        set((s) => ({
          windows: s.windows.map((x) =>
            x.id === wid
              ? {
                  ...x,
                  ...constrain(item),
                  maximized: item.maximized,
                  minimized: item.minimized,
                  snapped: item.snapped,
                  previous: item.previous,
                }
              : x,
          ),
        }));
      }
    }
    get().spaceAppearance(target, { wallpaper: l.wallpaper });
    get().switchSpace(target);
    const active = l.windows.find((w) => w.id === l.active);
    if (active) {
      const restored = get().windows.find(
        (w) => used.has(w.id) && w.appId === active.appId && !w.minimized,
      );
      if (restored) get().focus(restored.id);
    }
    get().notify(
      missing
        ? "Layout restored with unavailable files or single-instance apps skipped. Existing windows were kept."
        : "Workspace layout restored; existing windows kept",
      missing ? "warning" : "success",
    );
  },
  prefs,
  windows: restored,
  active:
    restored.findLast((w) => w.spaceId === activeSpace && !w.minimized)?.id ??
    null,
  recent: [],
  notices: [],
  hidden: [],
  setPrefs: (p) => {
    set((s) => ({ prefs: validatePreferences({ ...s.prefs, ...p }) }));
    if (p.wallpaper !== undefined)
      get().spaceAppearance(get().activeSpace, { wallpaper: p.wallpaper });
    writeStorage("preferences", get().prefs);
  },
  open: (appId, entryId) => {
    const app = appById(appId);
    const existing = get().windows.find((w) => w.appId === appId);
    if (app.single && existing) {
      if (entryId)
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === existing.id ? { ...w, entryId } : w,
          ),
        }));
      get().focus(existing.id);
    } else {
      const id = crypto.randomUUID();
      const n = get().windows.filter(
        (w) => w.spaceId === get().activeSpace,
      ).length;
      set((s) => ({
        windows: [
          ...s.windows,
          {
            id,
            appId,
            entryId,
            spaceId: get().activeSpace,
            ...constrain({
              x: 180 + ((n * 28) % 180),
              y: 50 + ((n * 25) % 120),
              width: app.width,
              height: app.height,
            }),
            minimized: false,
            maximized: false,
          },
        ],
        active: id,
      }));
    }
    set((s) => ({
      recent: [appId, ...s.recent.filter((a) => a !== appId)].slice(0, 5),
    }));
  },
  focus: (id) =>
    set((s) => {
      const w = s.windows.find((w) => w.id === id);
      return w
        ? {
            windows: [
              ...s.windows.filter((w) => w.id !== id),
              { ...w, minimized: false },
            ],
            activeSpace: w.spaceId ?? get().activeSpace,
            active: id,
          }
        : {};
    }),
  close: (id) => {
    if (interceptClose(id)) return;
    set((s) => {
      const windows = s.windows.filter((w) => w.id !== id);
      return {
        windows,
        hidden: s.hidden.filter((x) => x !== id),
        active:
          s.active === id
            ? (windows.findLast(
                (w) => w.spaceId === s.activeSpace && !w.minimized,
              )?.id ?? null)
            : s.active,
      };
    });
  },
  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w,
      ),
      active:
        s.active === id
          ? (s.windows.findLast(
              (w) => w.id !== id && w.spaceId === s.activeSpace && !w.minimized,
            )?.id ?? null)
          : s.active,
    })),
  maximize: (id) => {
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...(w.maximized || w.snapped ? constrain(w.previous ?? w) : {}),
              snapped: false,
              previous:
                w.maximized || w.snapped
                  ? undefined
                  : { x: w.x, y: w.y, width: w.width, height: w.height },
              maximized: !(w.maximized || w.snapped),
            }
          : w,
      ),
    }));
    get().focus(id);
  },
  bounds: (id, b) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...constrain({
                ...b,
                width: Math.max(appById(w.appId).minWidth, b.width),
                height: Math.max(appById(w.appId).minHeight, b.height),
              }),
              maximized: false,
              snapped: false,
              previous: undefined,
            }
          : w,
      ),
    })),
  snap: (id, side) => {
    const v = viewport();
    const target = get().windows.find((w) => w.id === id);
    if (target) {
      const app = appById(target.appId),
        width = side === "top" || side === "bottom" ? v.width : v.width / 2,
        height = side === "left" || side === "right" ? v.height : v.height / 2;
      if (width < app.minWidth || height < app.minHeight) {
        get().notify(
          "This snap layout is too small for this application. Maximize or resize it instead.",
          "warning",
        );
        return;
      }
    }
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...constrain({
                x: side.includes("right") ? v.width / 2 : 0,
                y: side.includes("bottom") ? v.height / 2 : 0,
                width:
                  side === "top" || side === "bottom" ? v.width : v.width / 2,
                height:
                  side === "left" || side === "right" ? v.height : v.height / 2,
              }),
              previous: w.previous ?? {
                x: w.x,
                y: w.y,
                width: w.width,
                height: w.height,
              },
              maximized: false,
              snapped: true,
            }
          : w,
      ),
    }));
    get().focus(id);
  },
  showDesktop: () => {
    const s = get();
    if (s.hidden.length)
      set({
        windows: s.windows.map((w) =>
          s.hidden.includes(w.id) ? { ...w, minimized: false } : w,
        ),
        active: s.hidden.at(-1) ?? null,
        hidden: [],
      });
    else
      set({
        hidden: s.windows
          .filter((w) => w.spaceId === s.activeSpace && !w.minimized)
          .map((w) => w.id),
        windows: s.windows.map((w) =>
          w.spaceId === s.activeSpace ? { ...w, minimized: true } : w,
        ),
        active: null,
      });
  },
  notify: (text, kind = "info") =>
    set((s) => ({
      notices: [
        { id: crypto.randomUUID(), text, kind, read: false, time: Date.now() },
        ...s.notices,
      ].slice(0, 100),
    })),
  readNotices: () =>
    set((s) => ({ notices: s.notices.map((n) => ({ ...n, read: true })) })),
  clearNotices: () => set({ notices: [] }),
}));
useDesk.subscribe((state, prev) => {
  if (state.windows !== prev.windows)
    writeStorage("windows", state.prefs.restore ? state.windows : []);
  if (state.prefs.restore !== prev.prefs.restore)
    writeStorage("windows", state.prefs.restore ? state.windows : []);
});

let spaceSaveTimer: ReturnType<typeof setTimeout> | undefined;
useDesk.subscribe((state, prev) => {
  if (
    state.spaces !== prev.spaces ||
    state.activeSpace !== prev.activeSpace ||
    state.layouts !== prev.layouts
  ) {
    clearTimeout(spaceSaveTimer);
    spaceSaveTimer = setTimeout(
      () =>
        writeStorage("spaces.v1", {
          version: 1,
          spaces: useDesk.getState().spaces,
          activeSpace: useDesk.getState().activeSpace,
          layouts: useDesk.getState().layouts,
        }),
      150,
    );
  }
});

if (typeof window !== "undefined")
  window.addEventListener("pagehide", () => {
    const s = useDesk.getState();
    writeStorage("spaces.v1", {
      version: 1,
      spaces: s.spaces,
      activeSpace: s.activeSpace,
      layouts: s.layouts,
    });
  });
