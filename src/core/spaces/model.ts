import { apps } from "../registry";
import type { AppId } from "../registry";
export const DEFAULT_SPACE = "desktop-1";
export type Space = {
  id: string;
  name: string;
  wallpaper: number;
  accent?: string;
  created: number;
  lastActive: number;
};
export type LayoutWindow = {
  id: string;
  appId: AppId;
  entryId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  snapped?: boolean;
  previous?: { x: number; y: number; width: number; height: number };
};
export type WorkspaceLayout = {
  id: string;
  name: string;
  kind: "snapshot" | "template";
  created: number;
  wallpaper: number;
  windows: LayoutWindow[];
  active?: string;
  version: 1;
};
export function validateSpaces(raw: unknown, wallpaper: number): Space[] {
  const rows = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const result = rows
    .filter(
      (s): s is Space =>
        s &&
        typeof s.id === "string" &&
        !seen.has(s.id) &&
        !!seen.add(s.id) &&
        typeof s.name === "string" &&
        s.name.trim().length > 0,
    )
    .slice(0, 24)
    .map((s) => ({
      id: s.id,
      name: s.name.trim().slice(0, 60),
      wallpaper:
        Number.isInteger(s.wallpaper) && s.wallpaper >= 0 && s.wallpaper < 6
          ? s.wallpaper
          : wallpaper,
      accent:
        typeof s.accent === "string" && /^#[a-f\d]{6}$/i.test(s.accent)
          ? s.accent
          : undefined,
      created: Number.isFinite(s.created) ? s.created : Date.now(),
      lastActive: Number.isFinite(s.lastActive) ? s.lastActive : Date.now(),
    }));
  return result.length
    ? result
    : [
        {
          id: DEFAULT_SPACE,
          name: "Desktop 1",
          wallpaper,
          created: Date.now(),
          lastActive: Date.now(),
        },
      ];
}
export function validateLayouts(raw: unknown): WorkspaceLayout[] {
  return Array.isArray(raw)
    ? raw
        .filter(
          (l): l is WorkspaceLayout =>
            l &&
            l.version === 1 &&
            typeof l.id === "string" &&
            typeof l.name === "string" &&
            ["snapshot", "template"].includes(l.kind) &&
            Array.isArray(l.windows),
        )
        .slice(0, 100)
        .map((l) => ({
          ...l,
          wallpaper:
            Number.isInteger(l.wallpaper) && l.wallpaper >= 0 && l.wallpaper < 6
              ? l.wallpaper
              : 0,
          windows: l.windows
            .filter(
              (w) =>
                w &&
                typeof w.id === "string" &&
                apps.some((a) => a.id === w.appId) &&
                ["x", "y", "width", "height"].every((k) =>
                  Number.isFinite(w[k as keyof LayoutWindow]),
                ),
            )
            .slice(0, 40),
        }))
    : [];
}
export const builtinTemplates: {
  name: string;
  apps: AppId[];
  wallpaper: number;
}[] = [
  {
    name: "Developer",
    apps: ["code", "terminal", "files", "notes"],
    wallpaper: 0,
  },
  {
    name: "Study",
    apps: ["pdf", "notes", "calculator", "files"],
    wallpaper: 3,
  },
  { name: "Creative", apps: ["canvas", "photos", "files"], wallpaper: 4 },
  { name: "Entertainment", apps: ["music", "cinema", "photos"], wallpaper: 2 },
];
