import { usePlatform } from "./platform/state";
import type { AppPackage } from "./platform/types";
import { lazy } from "react";
import {
  Folder,
  Code2,
  Terminal,
  StickyNote,
  Calculator,
  Settings,
  Music2,
  Images,
  Clapperboard,
  BookOpen,
  Palette,
  Archive,
  History,
  ShieldCheck,
  Package,
  Store,
  Blocks,
} from "lucide-react";
export type AppId =
  | "files"
  | "terminal"
  | "notes"
  | "calculator"
  | "settings"
  | "code"
  | "music"
  | "photos"
  | "cinema"
  | "pdf"
  | "canvas"
  | "capsule"
  | "time-machine"
  | "recovery"
  | "app-center"
  | "app-builder"
  | `pkg:${string}`;
export const builtInApps = [
  {
    id: "files",
    icon: Folder,
    component: lazy(() =>
      import("../applications/files/FileExplorer").then((m) => ({
        default: m.FileExplorer,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Files",
    category: "System",
    description: "Browse, organize and preview your local files",
    color: "#6eacfa",
    width: 1050,
    height: 660,
    minWidth: 360,
    minHeight: 280,
    single: false,
  },
  {
    id: "terminal",
    icon: Terminal,
    component: lazy(() =>
      import("../applications/terminal/Terminal").then((m) => ({
        default: m.TerminalApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Terminal",
    category: "Development",
    description: "Explore your desktop with DeskShell",
    color: "#9e91ed",
    width: 720,
    height: 440,
    minWidth: 340,
    minHeight: 260,
    single: false,
  },
  {
    id: "notes",
    icon: StickyNote,
    component: lazy(() =>
      import("../applications/editor/DocumentEditor").then((m) => ({
        default: m.NotesApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["md", "txt", "markdown"],
    name: "Notes",
    category: "Productivity",
    description: "A quiet place for your thoughts",
    color: "#f4c674",
    width: 780,
    height: 520,
    minWidth: 360,
    minHeight: 300,
    single: true,
  },
  {
    id: "calculator",
    icon: Calculator,
    component: lazy(() =>
      import("../applications/editor/Calculator").then((m) => ({
        default: m.CalculatorApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Calculator",
    category: "Utilities",
    description: "Make room for a little clarity",
    color: "#7bd6b5",
    width: 360,
    height: 500,
    minWidth: 300,
    minHeight: 420,
    single: true,
  },
  {
    id: "settings",
    icon: Settings,
    component: lazy(() =>
      import("../applications/Settings").then((m) => ({
        default: m.SettingsApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "Settings",
    category: "System",
    description: "Make this space your own",
    color: "#b5b9ca",
    width: 820,
    height: 580,
    minWidth: 360,
    minHeight: 300,
    single: true,
  },
  {
    id: "code",
    icon: Code2,
    component: lazy(() =>
      import("../applications/editor/DocumentEditor").then((m) => ({
        default: m.CodeStudio,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["html", "css", "js", "ts", "json", "md", "txt"],
    name: "Code Studio",
    category: "Development",
    description: "Edit shared files and preview web projects",
    color: "#76bce7",
    width: 1100,
    height: 700,
    minWidth: 400,
    minHeight: 320,
    single: false,
  },
  {
    id: "music",
    icon: Music2,
    component: lazy(() =>
      import("../applications/media/Music").then((m) => ({
        default: m.default,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["mp3", "wav", "ogg", "m4a", "flac"],
    name: "Music",
    category: "Creative",
    description: "Your music, in its own space",
    color: "#ec9db6",
    width: 1080,
    height: 700,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "photos",
    icon: Images,
    component: lazy(() =>
      import("../applications/media/Photos").then((m) => ({
        default: m.default,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["png", "jpg", "jpeg", "webp", "gif"],
    name: "Photos",
    category: "Creative",
    description: "A fresh perspective on your pictures",
    color: "#a9b4fc",
    width: 1080,
    height: 700,
    minWidth: 420,
    minHeight: 360,
    single: false,
  },
  {
    id: "cinema",
    icon: Clapperboard,
    component: lazy(() =>
      import("../applications/media/Cinema").then((m) => ({
        default: m.default,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["mp4", "webm", "ogv"],
    name: "Cinema",
    category: "Creative",
    description: "The best seat is yours",
    color: "#edb785",
    width: 1080,
    height: 700,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "pdf",
    icon: BookOpen,
    component: lazy(() =>
      import("../applications/media/Pdf").then((m) => ({ default: m.default })),
    ),
    resizable: true,
    supportedFileTypes: ["pdf"],
    name: "PDF Studio",
    category: "Creative",
    description: "Read, find and remember",
    color: "#89cbbb",
    width: 1080,
    height: 700,
    minWidth: 420,
    minHeight: 360,
    single: false,
  },
  {
    id: "canvas",
    icon: Palette,
    component: lazy(() =>
      import("../applications/media/Canvas").then((m) => ({
        default: m.default,
      })),
    ),
    resizable: true,
    supportedFileTypes: ["deskcanvas", "png", "jpg", "jpeg", "webp"],
    name: "Canvas",
    category: "Creative",
    description: "Make something entirely yours",
    color: "#c6a0ee",
    width: 1080,
    height: 700,
    minWidth: 420,
    minHeight: 360,
    single: false,
  },
  {
    id: "capsule",
    name: "Capsule",
    icon: Archive,
    component: lazy(() =>
      import("../applications/recovery/Recovery").then((m) => ({
        default: m.CapsuleApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    category: "System",
    description: "Portable backups of your local desktop",
    color: "#91bfb5",
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "time-machine",
    name: "Time Machine",
    icon: History,
    component: lazy(() =>
      import("../applications/recovery/Recovery").then((m) => ({
        default: m.TimeMachineApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    category: "System",
    description: "Explore saved versions and restore points",
    color: "#91bfb5",
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "recovery",
    name: "Recovery Center",
    icon: ShieldCheck,
    component: lazy(() =>
      import("../applications/recovery/Recovery").then((m) => ({
        default: m.RecoveryApp,
      })),
    ),
    resizable: true,
    supportedFileTypes: [] as string[],
    category: "System",
    description: "Inspect backups and recover your work",
    color: "#91bfb5",
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "app-center",
    icon: Store,
    component: lazy(() => import("../applications/platform/AppCenter")),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "App Center",
    category: "System",
    description: "Discover, install and manage local applications",
    color: "#a69bdf",
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
  {
    id: "app-builder",
    icon: Blocks,
    component: lazy(() => import("../applications/platform/AppBuilder")),
    resizable: true,
    supportedFileTypes: [] as string[],
    name: "App Builder",
    category: "System",
    description: "Build, preview and package small DeskOS apps",
    color: "#a69bdf",
    width: 1100,
    height: 720,
    minWidth: 420,
    minHeight: 360,
    single: true,
  },
] as const;
export type AppDefinition = {
  id: AppId;
  name: string;
  icon: typeof Package;
  component: (typeof builtInApps)[number]["component"];
  resizable: boolean;
  supportedFileTypes: readonly string[];
  category: string;
  description: string;
  color: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  single: boolean;
  source?: "builtin" | "package";
  manifest?: AppPackage["manifest"];
};
export const apps: AppDefinition[] = [...builtInApps];
const sandboxComponent = lazy(() => import("../applications/platform/Sandbox"));
function syncInstalled() {
  apps.splice(0, apps.length, ...builtInApps);
  for (const item of usePlatform
    .getState()
    .state.installed.filter((i) => i.enabled)) {
    const m = item.package.manifest;
    apps.push({
      id: `pkg:${m.id}`,
      name: m.name,
      icon: Package,
      component: sandboxComponent,
      resizable: true,
      supportedFileTypes: m.fileTypes,
      category: m.category,
      description:
        m.description + " / " + m.developer + " / " + m.keywords.join(" "),
      color: "#a6b8db",
      width: 780,
      height: 560,
      minWidth: 360,
      minHeight: 280,
      single: !m.multiple,
      source: "package",
      manifest: m,
    });
  }
}
syncInstalled();
usePlatform.subscribe((next, prev) => {
  if (next.state.installed !== prev.state.installed) syncInstalled();
});
export const appById = (id: AppId) => apps.find((a) => a.id === id)!;
export const searchApps = (query: string) =>
  apps.filter((a) =>
    `${a.name} ${a.description} ${a.category}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
