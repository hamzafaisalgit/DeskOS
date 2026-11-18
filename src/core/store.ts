import { create } from "zustand";
import { apps, appById } from "./registry";
import type { AppId } from "./registry";
import { readStorage, writeStorage } from "./storage";
export type Bounds = { x: number; y: number; width: number; height: number };
export type WindowState = Bounds & {
  id: string;
  appId: AppId;
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
    .slice(0, 20)
    .map((w) => ({
      ...constrain(w),
      id: w.id,
      appId: w.appId,
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
const restored = prefs.restore ? restoreWindows(saved) : [];
export type Notice = {
  id: string;
  text: string;
  kind: "info" | "success" | "warning" | "error";
  read: boolean;
  time: number;
};
type State = {
  prefs: Preferences;
  windows: WindowState[];
  active: string | null;
  recent: AppId[];
  notices: Notice[];
  hidden: string[];
  setPrefs: (p: Partial<Preferences>) => void;
  open: (id: AppId) => void;
  focus: (id: string) => void;
  close: (id: string) => void;
  minimize: (id: string) => void;
  maximize: (id: string) => void;
  bounds: (id: string, b: Bounds) => void;
  snap: (id: string, side: "left" | "right") => void;
  showDesktop: () => void;
  notify: (text: string, kind?: Notice["kind"]) => void;
  readNotices: () => void;
  clearNotices: () => void;
};
export const useDesk = create<State>((set, get) => ({
  prefs,
  windows: restored,
  active: restored.findLast((w) => !w.minimized)?.id ?? null,
  recent: [],
  notices: [],
  hidden: [],
  setPrefs: (p) => {
    set((s) => ({ prefs: validatePreferences({ ...s.prefs, ...p }) }));
    writeStorage("preferences", get().prefs);
  },
  open: (appId) => {
    const app = appById(appId);
    const existing = get().windows.find((w) => w.appId === appId);
    if (app.single && existing) get().focus(existing.id);
    else {
      const id = crypto.randomUUID();
      const n = get().windows.length;
      set((s) => ({
        windows: [
          ...s.windows,
          {
            id,
            appId,
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
            active: id,
          }
        : {};
    }),
  close: (id) =>
    set((s) => {
      const windows = s.windows.filter((w) => w.id !== id);
      return {
        windows,
        hidden: s.hidden.filter((x) => x !== id),
        active:
          s.active === id
            ? (windows.findLast((w) => !w.minimized)?.id ?? null)
            : s.active,
      };
    }),
  minimize: (id) =>
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id ? { ...w, minimized: true } : w,
      ),
      active:
        s.active === id
          ? (s.windows.findLast((w) => w.id !== id && !w.minimized)?.id ?? null)
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
    set((s) => ({
      windows: s.windows.map((w) =>
        w.id === id
          ? {
              ...w,
              ...constrain({
                x: side === "left" ? 0 : v.width / 2,
                y: 0,
                width: v.width / 2,
                height: v.height,
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
        hidden: s.windows.filter((w) => !w.minimized).map((w) => w.id),
        windows: s.windows.map((w) => ({ ...w, minimized: true })),
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
